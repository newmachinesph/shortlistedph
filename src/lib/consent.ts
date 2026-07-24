import "server-only";
import { db } from "./db";
import { mail } from "./email";
import { HttpError } from "./session";
import { composite } from "./scoring";
import { blendSimilarity } from "./facets";
import { candidateDims, explain, frozenProfileJson, type Jd } from "./matching";

/**
 * Consent-first matching, candidate side. A MatchConsent row is created at
 * buildSlate time (lib/matching.ts), emailed at admin approval, and answered
 * here. The token in the email IS the credential — the migrated pool has no
 * passwords, so nothing in this file requires a session.
 */

export const CONSENT_WINDOW_HOURS = 48;

/** Stop inviting once a JD has burned through this many consents — pool exhausted. */
export const CONSENT_CAP_MULTIPLIER = 3;

/**
 * Emails the pending, not-yet-sent consents for a JD, oldest first. The
 * countdown starts at SEND: expiresAt is stamped sentAt + 48h only when the
 * email actually went out. mail.matchConsentRequest rides the outreach kill
 * switch — when suppressed it returns false, the consent stays unsent, and the
 * cron retries once outreach is back on. Nothing unsent can ever expire anyone.
 */
export async function sendConsentRequests(jdId: string, limit?: number): Promise<{ sent: number }> {
  const pending = await db.matchConsent.findMany({
    where: { jdId, status: "pending", sentAt: null },
    orderBy: { createdAt: "asc" },
    ...(limit ? { take: limit } : {}),
    select: {
      id: true,
      token: true,
      profile: { select: { user: { select: { email: true } } } },
      jd: {
        select: {
          title: true,
          budgetMin: true,
          budgetMax: true,
          hoursPerWeek: true,
          overlap: true,
          mustHaves: true,
        },
      },
    },
  });

  let sent = 0;
  for (const c of pending) {
    const delivered = await mail.matchConsentRequest(c.profile.user.email, {
      token: c.token,
      title: c.jd.title,
      budgetMin: c.jd.budgetMin,
      budgetMax: c.jd.budgetMax,
      hoursPerWeek: c.jd.hoursPerWeek,
      overlap: c.jd.overlap,
      mustHaves: c.jd.mustHaves,
    });
    if (!delivered) continue;
    const now = new Date();
    await db.matchConsent.update({
      where: { id: c.id },
      data: { sentAt: now, expiresAt: new Date(now.getTime() + CONSENT_WINDOW_HOURS * 3_600_000) },
    });
    sent++;
  }
  return { sent };
}

/** Everything the response page and API need, fetched by token alone. */
export async function getConsentByToken(token: string) {
  return db.matchConsent.findUnique({
    where: { token },
    select: {
      id: true,
      status: true,
      sentAt: true,
      expiresAt: true,
      jdId: true,
      profileId: true,
      // GENERIC JD data only — the employer/company name never rides a consent
      // (hidden-JD principle), so it is not even selected here.
      jd: {
        select: {
          title: true,
          budgetMin: true,
          budgetMax: true,
          hoursPerWeek: true,
          overlap: true,
          mustHaves: true,
        },
      },
    },
  });
}

export function isConsentExpired(c: { status: string; expiresAt: Date | null }): boolean {
  return (
    c.status === "expired" ||
    (c.status === "pending" && c.expiresAt != null && c.expiresAt.getTime() < Date.now())
  );
}

/** Expiry ⇒ one strike, wherever it is detected (POST route or cron). */
async function markExpired(consentId: string, profileId: string) {
  await db.$transaction([
    db.matchConsent.updateMany({
      where: { id: consentId, status: "pending" },
      data: { status: "expired" },
    }),
    db.talentProfile.updateMany({
      where: { id: profileId, dormantAt: null },
      data: { dormantAt: new Date() },
    }),
  ]);
}

/**
 * The one write path for a consent answer. Idempotent: a second answer (or a
 * race between two tabs) hits the conditional update, matches 0 rows and
 * reports "already responded" instead of double-placing anyone.
 *
 * ACCEPT re-scores the candidate against the JD's STORED vectors (no embedding
 * API call), freezes the profile into a snapshot, appends a SlateEntry at the
 * next rank, and stamps the rotation counters — the stamps moved here from
 * buildSlate because being asked costs nothing; being shown is what counts.
 *
 * DECLINE is just an answer. No dormancy penalty.
 */
export async function respondToConsent(token: string, action: "accept" | "decline") {
  const consent = await getConsentByToken(token);
  if (!consent) throw new HttpError(404, "This link is no longer valid");

  if (consent.status !== "pending") {
    throw new HttpError(
      409,
      consent.status === "expired"
        ? "This request expired before it was answered"
        : "You already responded to this request",
    );
  }

  if (isConsentExpired(consent)) {
    await markExpired(consent.id, consent.profileId);
    throw new HttpError(410, "This request expired before it was answered");
  }

  if (action === "decline") {
    const { count } = await db.matchConsent.updateMany({
      where: { id: consent.id, status: "pending" },
      data: { status: "declined", respondedAt: new Date() },
    });
    if (count === 0) throw new HttpError(409, "You already responded to this request");
    return { status: "declined" as const };
  }

  // ── Accept ─────────────────────────────────────────────────────────────
  const [jd, profile, slate] = await Promise.all([
    db.jobDescription.findUniqueOrThrow({ where: { id: consent.jdId } }),
    db.talentProfile.findUniqueOrThrow({
      where: { id: consent.profileId },
      include: { skills: true, engagements: true },
    }),
    db.slate.findFirst({
      where: { jdId: consent.jdId, status: { not: "pending_review" } },
      orderBy: { deliveredAt: "desc" },
      select: { id: true },
    }),
  ]);
  // Consents are only emailed after admin approval, so an approved slate must
  // exist by the time anyone can click accept.
  if (!slate) throw new HttpError(409, "This shortlist is no longer active");

  // Distances between the STORED profile and JD vectors — same facets, same
  // COALESCE fallback as the ranking query. 0.5 (neutral similarity) if a row
  // somehow has no vectors at all.
  const [d] = await db.$queryRawUnsafe<{ dskills: number; dexp: number; dprefs: number }[]>(
    `SELECT COALESCE(p."embeddingSkills" <=> j."embeddingSkills", p.embedding <=> j.embedding, 0.5) AS dskills,
            COALESCE(p."embeddingExperience" <=> j.embedding, p.embedding <=> j.embedding, 0.5) AS dexp,
            COALESCE(p."embeddingPrefs" <=> j.embedding, p.embedding <=> j.embedding, 0.5) AS dprefs
       FROM "TalentProfile" p, "JobDescription" j
      WHERE p.id = $1 AND j.id = $2`,
    profile.id,
    jd.id,
  );
  const sim = d ? blendSimilarity(d.dskills, d.dexp, d.dprefs) : 0.5;

  const dims = candidateDims(jd, profile, profile.skills, profile.engagements, sim);
  const score = composite(dims, profile.verifiedTier === "id_verified");

  // LLM narration BEFORE the transaction — it can take seconds and degrade to
  // no bullets, neither of which belongs inside a db transaction.
  const jdShape: Jd = jd;
  const [reasons = []] = await explain(jdShape, [{ c: profile, dims, score, skills: profile.skills }]);

  await db.$transaction(async (tx) => {
    // Serialize concurrent accepts for THIS slate. Two candidates clicking
    // accept within the same window would otherwise both read the same max
    // rank and insert a colliding rank; the row lock makes rank assignment
    // below atomic without a schema-level unique that could reject legacy data.
    await tx.$executeRaw`SELECT id FROM "Slate" WHERE id = ${slate.id} FOR UPDATE`;

    const { count } = await tx.matchConsent.updateMany({
      where: { id: consent.id, status: "pending" },
      data: { status: "accepted", respondedAt: new Date() },
    });
    if (count === 0) throw new HttpError(409, "You already responded to this request");

    // Freeze the profile as of this JD. Later edits cannot change what the
    // employer sees — this is what makes the anti-tailoring claim literal.
    const snapshot = await tx.profileSnapshot.upsert({
      where: { profileId_jdId: { profileId: profile.id, jdId: jd.id } },
      create: {
        profileId: profile.id,
        jdId: jd.id,
        frozenJson: frozenProfileJson(
          profile,
          profile.skills,
          profile.engagements,
          jd.publishedAt ?? new Date(),
        ),
      },
      update: {},
    });

    // Append at the next rank: the slate grows in acceptance order, which is
    // also invitation order for the common case.
    const last = await tx.slateEntry.findFirst({
      where: { slateId: slate.id },
      orderBy: { rank: "desc" },
      select: { rank: true },
    });

    await tx.slateEntry.create({
      data: {
        slateId: slate.id,
        snapshotId: snapshot.id,
        rank: (last?.rank ?? 0) + 1,
        score,
        dims,
        reasons,
      },
    });

    // Rotation counters stamp on ACCEPT, not at build: only candidates who are
    // actually shown to an employer move to the back of the rotation.
    await tx.talentProfile.update({
      where: { id: profile.id },
      data: { shortlistCount: { increment: 1 }, lastShownAt: new Date() },
    });
  });

  return { status: "accepted" as const };
}

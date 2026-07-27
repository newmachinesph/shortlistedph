import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { mail } from "./email";
import { candidateRoleLabel } from "./openings-shape";
import { notify } from "./notify";
import { HttpError } from "./session";
import { outreachEmailsEnabled } from "./settings";

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
 * Delivery failures after which a consent is parked rather than retried.
 *
 * Three, not one: a single transport blip must never burn a real invitation.
 */
export const CONSENT_MAX_SEND_ATTEMPTS = 3;

/**
 * Emails the pending, not-yet-sent consents for a JD, oldest first. The
 * countdown starts at SEND: expiresAt is stamped sentAt + 48h only when the
 * email actually went out. While the outreach kill switch is off this does
 * nothing at all and the consents wait, untouched, for it to come back on.
 * Nothing unsent can ever expire anyone.
 *
 * `limit` counts DELIVERIES, not attempts — see the loop.
 */
export async function sendConsentRequests(jdId: string, limit?: number): Promise<{ sent: number }> {
  // The kill switch is read HERE, once, instead of being inferred from a false
  // return inside the loop. mail.matchConsentRequest reports a suppressed send
  // and a genuine transport failure identically, so counting the suppressed one
  // would park the entire pool within CONSENT_MAX_SEND_ATTEMPTS runs of
  // outreach being switched off — the exact accident the schema comment warns
  // about. With this, every `delivered === false` below is a real failure.
  if (!(await outreachEmailsEnabled())) return { sent: 0 };

  const pending = await db.matchConsent.findMany({
    where: {
      jdId,
      status: "pending",
      sentAt: null,
      // A closed role must stop recruiting. Nothing unsent goes out for one, so
      // an employer who fills the job never has more candidates asked on its
      // behalf — the cron's own filter covers the backfill path, this covers
      // consents created before the close.
      jd: { status: { not: "closed" } },
      // Same shape of promise on the candidate's side. "Take me out of
      // matching" says no new invitations are sent, and the consents queued
      // before the toggle was flipped are exactly the ones that would break it:
      // the JD-status filter above never sees them. Withheld, not cancelled —
      // an unsent row keeps its place and goes out if they opt back in.
      //
      // Invitations already SENT stay answerable, deliberately. The email is in
      // their inbox with a live 48h clock; opting out of future matching is not
      // a decision to abandon the one offer they are already holding, and
      // killing the link silently would leave the expiry cron free to stamp a
      // dormancy strike for an invite we had barred them from answering. The
      // toggle's own copy scopes itself the same way ("no NEW invitations").
      //
      // THIS LIST MUST MATCH THE POOL QUERY in lib/matching.ts. It did not:
      // this end checked `visibility` alone while the engine end had grown
      // three more gates, so unticking "I'm open to new offers" stopped new
      // ranking and still let every already-queued invitation through — the
      // one promise the checkbox makes in so many words. Being un-matchable
      // has four doors and all four have to close the outbox too.
      profile: {
        visibility: true,
        openToOffers: true,
        dormantAt: null,
        availability: { not: "booked" },
        user: { status: "active" },
      },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      token: true,
      sendAttempts: true,
      profile: { select: { user: { select: { email: true } } } },
      jd: {
        select: {
          // NEVER the raw `title` — that is the employer's own wording and can
          // name the client. candidateRoleLabel is the only door.
          publicTitle: true,
          roleFamily: true,
          budgetMin: true,
          budgetMax: true,
          hoursPerWeek: true,
          overlap: true,
          mustHaves: true,
        },
      },
    },
    // Deliberately unbounded: a JD can hold at most SLATE_SIZE *
    // CONSENT_CAP_MULTIPLIER consents, so this set is small, and taking exactly
    // `limit` rows is what let one undeliverable address hold the slot forever.
  });

  let sent = 0;
  for (const c of pending) {
    // A failed send must not consume the caller's budget. The old code took
    // exactly `limit` rows oldest-first and counted attempts, so a permanently
    // undeliverable address was re-picked every hour, blocked the slot, and
    // still counted against the JD's consent cap — the JD reached "pool
    // exhausted" having delivered nothing. Counting deliveries means the bad
    // row costs one wasted attempt per run and nothing else.
    if (limit != null && sent >= limit) break;
    const delivered = await mail.matchConsentRequest(c.profile.user.email, {
      token: c.token,
      roleLabel: candidateRoleLabel(c.jd),
      budgetMin: c.jd.budgetMin,
      budgetMax: c.jd.budgetMax,
      hoursPerWeek: c.jd.hoursPerWeek,
      overlap: c.jd.overlap,
      mustHaves: c.jd.mustHaves,
    });
    if (!delivered) {
      // A real delivery failure. Count it, and park the row once it has failed
      // CONSENT_MAX_SEND_ATTEMPTS times so one dead address stops being retried
      // every hour forever. Parking is "expired" with NO dormancy strike: the
      // candidate was never reached, so there is nothing for them to have
      // ignored — and leaving it "pending" with a null expiresAt was what kept
      // it immortal, since the expiry cron only touches rows that were sent.
      const attempts = c.sendAttempts + 1;
      const parked = attempts >= CONSENT_MAX_SEND_ATTEMPTS;
      await db.matchConsent.update({
        where: { id: c.id },
        data: { sendAttempts: attempts, ...(parked ? { status: "expired" } : {}) },
      });
      if (parked) {
        console.warn(
          `[consent] parked ${c.id} after ${attempts} failed deliveries to ${c.profile.user.email}`,
        );
      }
      continue;
    }
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
      // The ranking frozen at invite time (lib/matching.ts inviteCandidates).
      // Accepting copies these onto the slate — it never re-scores.
      slateId: true,
      snapshotId: true,
      score: true,
      dims: true,
      reasons: true,
      // GENERIC JD data only — the employer/company name never rides a consent
      // (hidden-JD principle), so it is not even selected here. That includes
      // the raw `title`: it is the employer's own wording and the openings
      // board already treats it as capable of naming the client. Callers render
      // candidateRoleLabel(jd) instead.
      jd: {
        select: {
          publicTitle: true,
          roleFamily: true,
          budgetMin: true,
          budgetMax: true,
          hoursPerWeek: true,
          overlap: true,
          mustHaves: true,
          // Not shown to the candidate — decides whether an expired invite
          // deserves a dormancy strike, and whether an accept is still legal.
          status: true,
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

/**
 * Expiry ⇒ one strike, wherever it is detected (POST route or cron).
 *
 * `penalise` is false when the strike would be unfair: the role was closed
 * before the window ran out (nobody could have accepted it), or the candidate
 * turned up late but did answer — an answer is participation, which is the
 * only thing dormancy is meant to measure.
 */
async function markExpired(consentId: string, profileId: string, penalise = true) {
  await db.$transaction([
    db.matchConsent.updateMany({
      where: { id: consentId, status: "pending" },
      data: { status: "expired" },
    }),
    ...(penalise
      ? [
          db.talentProfile.updateMany({
            where: { id: profileId, dormantAt: null },
            data: { dormantAt: new Date() },
          }),
        ]
      : []),
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
    // Someone who opens the link late to say no is answering, not ignoring —
    // and a closed role was never answerable. Neither earns a strike.
    const penalise = action !== "decline" && consent.jd.status !== "closed";
    await markExpired(consent.id, consent.profileId, penalise);
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
  // Nothing is scored here. The snapshot, score, dims and bullets were all
  // frozen at invite time, BEFORE this candidate was shown the job's
  // must-haves (lib/matching.ts inviteCandidates). Accepting is a copy.
  const { slateId, snapshotId, score, dims, reasons } = consent;
  if (!slateId || !snapshotId || score == null || dims == null) {
    // Only reachable if a consent row was written by something other than
    // inviteCandidates — a bug, not a user state. Fail loud rather than
    // silently re-scoring after disclosure, which is what this replaced.
    console.error(`[consent] invite ${consent.id} has no frozen ranking — refusing to score post-disclosure`);
    throw new HttpError(409, "This invitation is no longer valid — support can re-issue it");
  }

  const slate = await db.slate.findUnique({
    where: { id: slateId },
    select: { id: true, status: true, jd: { select: { status: true } } },
  });
  // Consents are only emailed after admin approval, so an approved slate must
  // exist by the time anyone can click accept.
  if (!slate || slate.status === "pending_review") {
    throw new HttpError(409, "This shortlist is no longer active");
  }
  // The employer closed the role after the invitation went out. Placing
  // someone on a dead job's shortlist would waste their yes and their rotation
  // turn — the accept is refused, and no dormancy strike is applied because
  // they did answer.
  if (slate.jd.status === "closed") {
    throw new HttpError(409, "This role has been closed by the employer");
  }

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
        snapshotId,
        rank: (last?.rank ?? 0) + 1,
        score,
        dims: dims as Prisma.InputJsonValue,
        reasons,
      },
    });

    // Rotation counters stamp on ACCEPT, not at build: only candidates who are
    // actually shown to an employer move to the back of the rotation.
    await tx.talentProfile.update({
      where: { id: consent.profileId },
      data: { shortlistCount: { increment: 1 }, lastShownAt: new Date() },
    });
  });

  await notifySlateGrew(slateId, consent.jdId);

  return { status: "accepted" as const };
}

/**
 * Post-commit, best-effort: tell the employer their shortlist grew.
 *
 * A consent-first slate fills one accept at a time, and the employer was told
 * exactly once — at admin approval — that candidates were "confirming
 * availability now". Without this they had to keep reloading the brief to find
 * out whether anyone had said yes.
 */
async function notifySlateGrew(slateId: string, jdId: string) {
  try {
    const [jd, total] = await Promise.all([
      db.jobDescription.findUnique({
        where: { id: jdId },
        select: { title: true, employer: { select: { userId: true } } },
      }),
      db.slateEntry.count({ where: { slateId } }),
    ]);
    if (!jd) return;
    await notify({
      userId: jd.employer.userId,
      type: "slate_candidate_confirmed",
      payload: { jdId, jobTitle: jd.title, total },
    });
  } catch (e) {
    console.error("[consent] slate-growth notification failed", e);
  }
}

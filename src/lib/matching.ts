import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "./db";
import { blendSimilarity, jdFacetTexts } from "./facets";
import { applyHardFilters, jdHardRequirements } from "./filters";
import { embedMany, toVectorLiteral } from "./openai";
import { hardFiltersEnabled } from "./settings";
import {
  MIN_SLATE_SCORE,
  QUALIFY_SCORE,
  QUALIFY_SKILLS,
  compareRotation,
  composite,
  explainMatch,
  scoreExperience,
  scoreOverlap,
  scoreRate,
  scoreSkills,
  type Dims,
} from "./scoring";

export type { Dims };

export const SLATE_SIZE = 5;
const CANDIDATE_POOL = 50;

/**
 * How much deeper the ANN cut reaches when Stage 0 is on.
 *
 * Hard filters must only ever ADD candidates the shallow cut missed. Filtering
 * a fixed 50 could eliminate 45 and then rank the surviving 5, while 51–95 —
 * who would have passed — were never fetched at all. So the cut goes deep and
 * the filter stops at CANDIDATE_POOL survivors: same pool size, better pool.
 */
const STAGE0_POOL_MULTIPLIER = 3;

// A candidate whose availability was confirmed within this window is treated as
// "fresh" and gets a light nudge up the rotation — never a hard filter.
const AVAILABILITY_FRESH_DAYS = 14;

type Candidate = {
  id: string;
  userId: string;
  headline: string | null;
  summary: string | null;
  city: string | null;
  yearsExperience: number;
  rateUsd: number | null;
  availability: string;
  committedHours: number;
  verifiedTier: string;
  lastEditedAt: Date;
  shortlistCount: number;
  lastShownAt: Date | null;
  /** Invitations received across all JDs — the rotation turn counter. */
  inviteCount: number;
  lastInvitedAt: Date | null;
  availabilityConfirmedAt: Date | null;
  // Facet cosine distances; each COALESCEs to the whole-profile distance when
  // the facet column is NULL, so un-backfilled profiles rank as before.
  dskills: number;
  dexp: number;
  dprefs: number;
};

export type Jd = {
  id: string;
  title: string;
  mustHaves: string[];
  niceToHaves: string[];
  budgetMin: number | null;
  budgetMax: number | null;
  hoursPerWeek: number | null;
  overlap: string | null;
  /** Stage 0 hard requirements; absent/null derives from budgetMax + hoursPerWeek. */
  hardRequirements?: unknown;
};

// Owned by filters.ts, where the pure Stage 0 logic (and its tests) live —
// re-exported here because this module is the door every caller already uses.
export { jdHardRequirements };

// Single owner is facets.ts — the eval harness and backfill embed this exact text.
export function jdEmbedText(jd: Jd): string {
  return jdFacetTexts(jd).role;
}

export type RankedCandidate = {
  c: Candidate;
  dims: Dims;
  score: number;
  fresh: boolean;
  skills: { name: string; confirmed: boolean; normalizedName: string }[];
  engagements: { role: string; company: string; span: string; outcome: string }[];
};

/**
 * The four scored dimensions for one candidate against one JD. Shared by the
 * full ranking below and the consent-accept path, which re-scores a single
 * candidate when they land on the slate.
 */
export function candidateDims(
  jd: Pick<Jd, "mustHaves" | "budgetMin" | "budgetMax" | "hoursPerWeek">,
  c: {
    headline: string | null;
    yearsExperience: number;
    rateUsd: number | null;
    availability: string;
    committedHours: number;
  },
  cSkills: { normalizedName: string; confirmed: boolean }[],
  cEng: { role: string; outcome: string }[],
  sim: number,
): Dims {
  return {
    skills: scoreSkills(jd.mustHaves, cSkills, sim, {
      headline: c.headline,
      roles: cEng.map((e) => e.role),
    }),
    rate: scoreRate(c.rateUsd, jd.budgetMin, jd.budgetMax),
    overlap: scoreOverlap(c.availability, c.committedHours, jd.hoursPerWeek),
    experience: scoreExperience(c.yearsExperience, cEng.filter((e) => e.outcome === "confirmed").length),
  };
}

/**
 * The frozen profile JSON a ProfileSnapshot stores. One shape, one owner —
 * created at INVITE time (before the candidate has seen the job's must-haves),
 * read by maskEntry and the dossier pages.
 */
export function frozenProfileJson(
  c: {
    userId: string;
    headline: string | null;
    summary: string | null;
    city: string | null;
    yearsExperience: number;
    rateUsd: number | null;
    availability: string;
    committedHours: number;
    verifiedTier: string;
    lastEditedAt: Date;
  },
  skills: { name: string; confirmed: boolean }[],
  engagements: { role: string; company: string; span: string; outcome: string }[],
  publishedAt: Date,
) {
  return {
    name: null, // filled from user at read time; masked while locked
    userId: c.userId,
    headline: c.headline,
    summary: c.summary,
    city: c.city,
    yearsExperience: c.yearsExperience,
    rateUsd: c.rateUsd,
    availability: c.availability,
    committedHours: c.committedHours,
    verifiedTier: c.verifiedTier,
    profileStableDays: Math.max(
      0,
      Math.floor((publishedAt.getTime() - c.lastEditedAt.getTime()) / 86_400_000),
    ),
    skills: skills.map((s) => ({ name: s.name, confirmed: s.confirmed })),
    engagements: engagements.map((e) => ({
      role: e.role,
      company: e.company,
      span: e.span,
      outcome: e.outcome,
    })),
  };
}

/**
 * Ranks the market against one JD and returns everyone who clears the bar, in
 * rotation order. Shared by buildSlate (initial consent fan-out) and the
 * consent-refresh cron (backfill re-runs this instead of persisting a queue).
 */
export async function rankQualifiedForJd(jd: Jd): Promise<{
  scanned: number;
  eligible: RankedCandidate[];
  /**
   * Scored but below the quality gates. Production ignores these; the eval
   * harness reads them, because the distance between the best reject and the
   * bar is exactly what the thresholds in scoring.ts were reasoned from.
   */
  rejected: RankedCandidate[];
  /**
   * Stage 0 eliminations from this run, or null when the flag is off — "no
   * verdict", which is not the same as "eliminated nobody". recordEliminations
   * relies on the difference.
   */
  eliminated: { profileId: string; reason: string }[] | null;
}> {
  // Two query vectors, one batch call: the whole-JD role text (also the hnsw
  // pool cut) and the skills-facet text.
  const q = jdFacetTexts(jd);
  const [roleVec, skillsVec] = await embedMany([q.role, q.skills]);

  const stage0On = await hardFiltersEnabled();
  const cut = stage0On ? CANDIDATE_POOL * STAGE0_POOL_MULTIPLIER : CANDIDATE_POOL;
  // ef_search is the HNSW candidate list; it must be at least the LIMIT for the
  // scan to be able to return that many rows at all, and comfortably above it
  // for the rows it returns to be the right ones. 2× is the usual recall/latency
  // trade; pgvector's own ceiling is 1000.
  // ponytail: fixed 2× multiplier — tune only if a recall measurement asks for it.
  const efSearch = Math.min(1000, cut * 2);

  // openToOffers and booked are filtered HERE, not in Stage 0, because neither
  // is an operator preference: someone who unticked "open to new offers" said
  // no to the whole question, and someone fully booked has nothing to sell this
  // employer — 15% overlap weight could never stop skills 90 / rate 100 from
  // leading a slate with them. Both belong to the same class as visibility and
  // dormancy: not matchable, so never fetched, whatever the flag says.
  //
  // The WHERE below is one half of the definition of "matchable". The other is
  // sendConsentRequests in lib/consent.ts, which decides whether an invitation
  // already queued may still be emailed — a candidate can opt out in the gap
  // between the two. Change either list and change both, or opting out stops
  // new ranking while the backlog keeps arriving.
  const rawPool = await db.$transaction(
    async (tx) => {
      // hnsw.ef_search caps how many candidates the index will even consider,
      // and its default of 40 was silently the real pool size: an ANN scan
      // cannot return more rows than it examined, so `LIMIT 150` returned ~40
      // and Stage 0's "3× deeper pool" was a no-op — it shrank the delivered
      // pool while claiming to deepen it. Even the flag-off path was quietly
      // capped at 40 of its 50.
      //
      // SET LOCAL only holds for the current transaction on the current
      // connection, and Prisma hands out a fresh pooled connection per
      // top-level call — so the setting must be issued inside the SAME
      // interactive transaction as the SELECT. It reverts on commit, so nothing
      // leaks back into the pool. Interpolated, not bound: SET takes no
      // parameters, and the value is arithmetic on module constants.
      await tx.$executeRawUnsafe(`SET LOCAL hnsw.ef_search = ${efSearch}`);
      return tx.$queryRawUnsafe<Candidate[]>(
    `SELECT p.id, p."userId", p.headline, p.summary, p.city, p."yearsExperience",
            p."rateUsd", p.availability, p."committedHours", p."verifiedTier", p."lastEditedAt",
            p."shortlistCount", p."lastShownAt", p."availabilityConfirmedAt",
            COALESCE(mc.invites, 0)::int AS "inviteCount", mc."lastInvitedAt",
            COALESCE(p."embeddingSkills" <=> $2::vector, p.embedding <=> $1::vector) AS dskills,
            COALESCE(p."embeddingExperience" <=> $1::vector, p.embedding <=> $1::vector) AS dexp,
            COALESCE(p."embeddingPrefs" <=> $1::vector, p.embedding <=> $1::vector) AS dprefs
       FROM "TalentProfile" p
       JOIN "user" u ON u.id = p."userId"
       LEFT JOIN (
         SELECT "profileId", count(*) AS invites, max("createdAt") AS "lastInvitedAt"
           FROM "MatchConsent" GROUP BY "profileId"
       ) mc ON mc."profileId" = p.id
      WHERE p."publishedAt" IS NOT NULL
        AND p.visibility = true
        AND p."dormantAt" IS NULL
        AND p."openToOffers" = true
        AND p.availability <> 'booked'
        AND p.embedding IS NOT NULL
        AND u.status = 'active'
      ORDER BY p.embedding <=> $1::vector
      LIMIT ${cut}`,
        toVectorLiteral(roleVec),
        toVectorLiteral(skillsVec),
      );
    },
    // The scan itself is milliseconds; Neon waking up is not. Both defaults are
    // too tight for a serverless cold start — maxWait (2s) is the one that
    // actually fires, throwing P2028 "unable to start a transaction in the given
    // time" and failing a whole matching run before a single row was read.
    { maxWait: 10_000, timeout: 20_000 },
  );

  // Stage 0 — hard filters (spec §3), behind the operator flag. Off means the
  // raw pool passes through untouched: today's behaviour exactly. On, it walks
  // the deeper cut and stops at CANDIDATE_POOL survivors, so turning the flag
  // on can only change WHO is in the pool, never how many.
  const stage0 = stage0On
    ? applyHardFilters(rawPool, jdHardRequirements(jd), CANDIDATE_POOL)
    : null;
  const pool = stage0?.passed ?? rawPool;
  const eliminated = stage0?.eliminated ?? null;

  if (pool.length === 0) {
    return { scanned: rawPool.length, eligible: [], rejected: [], eliminated };
  }

  const ids = pool.map((c) => c.id);
  const [skills, engagements] = await Promise.all([
    db.skill.findMany({ where: { profileId: { in: ids } } }),
    db.engagement.findMany({ where: { profileId: { in: ids } } }),
  ]);

  const skillsBy = new Map<string, typeof skills>();
  for (const s of skills) {
    const list = skillsBy.get(s.profileId) ?? [];
    list.push(s);
    skillsBy.set(s.profileId, list);
  }
  const engBy = new Map<string, typeof engagements>();
  for (const e of engagements) {
    const list = engBy.get(e.profileId) ?? [];
    list.push(e);
    engBy.set(e.profileId, list);
  }

  const freshCutoff = Date.now() - AVAILABILITY_FRESH_DAYS * 86_400_000;

  const scored = pool
    .map((c) => {
      const cSkills = skillsBy.get(c.id) ?? [];
      const cEng = engBy.get(c.id) ?? [];
      const sim = blendSimilarity(c.dskills, c.dexp, c.dprefs);
      const dims = candidateDims(jd, c, cSkills, cEng, sim);
      const fresh = (c.availabilityConfirmedAt?.getTime() ?? 0) >= freshCutoff;
      return {
        c,
        dims,
        score: composite(dims, c.verifiedTier === "id_verified"),
        fresh,
        skills: cSkills,
        engagements: cEng,
      };
    });

  // Quality gates eligibility: a candidate rotates only if the composite
  // clears QUALIFY *and* there is real skill overlap for this job. Fairness
  // never places anyone below the bar; padding can't buy a wrong-domain slot.
  const qualifies = (r: RankedCandidate) =>
    r.score >= QUALIFY_SCORE && r.dims.skills >= QUALIFY_SKILLS;
  const rejected = scored.filter((r) => !qualifies(r)).sort((a, b) => b.score - a.score);

  // Rotate among the qualified — see compareRotation in scoring.ts for why the
  // turn counter is invitations and not placements.
  const eligible = scored.filter(qualifies).sort(compareRotation);

  return { scanned: rawPool.length, eligible, rejected, eliminated };
}

/**
 * Consent-first matching: ranking is unchanged, but nobody appears on a slate
 * without saying yes first. This creates the Slate EMPTY (pending_review) plus
 * a pending MatchConsent for each of the top qualified candidates. Consent
 * emails go out at admin approval (lib/admin.ts), entries + snapshots +
 * rotation stamps happen at consent ACCEPT (lib/consent.ts), and the hourly
 * consent-refresh cron expires non-responders and backfills from the ranking —
 * re-run, not persisted, so there is no queue table to drift.
 */
export async function buildSlate(jdId: string) {
  const jd = await db.jobDescription.findUniqueOrThrow({ where: { id: jdId } });
  const { scanned, eligible, eliminated } = await rankQualifiedForJd(jd);

  await recordEliminations(jd.id, eliminated);

  if (scanned === 0) {
    // Terminal state, not "still matching" — otherwise the dashboard spins forever.
    await db.jobDescription.update({ where: { id: jd.id }, data: { status: "no_matches" } });
    return { slateId: null, scanned: 0, invited: 0 };
  }

  // Lead with strong matches (>= MIN_SLATE_SCORE), preserving rotation order
  // within each tier; only backfill with merely-eligible (QUALIFY..MIN) when
  // there aren't enough strong ones to fill the slate. Keeps slates full while
  // never showing a borderline candidate ahead of an available strong one.
  const strong = eligible.filter((e) => e.score >= MIN_SLATE_SCORE);
  const rest = eligible.filter((e) => e.score < MIN_SLATE_SCORE);
  const top = [...strong, ...rest].slice(0, SLATE_SIZE);

  // Nobody cleared the bar. Record that honestly instead of creating an empty
  // slate the employer could be charged to "unlock".
  if (top.length === 0) {
    await db.jobDescription.update({ where: { id: jd.id }, data: { status: "no_matches" } });
    return { slateId: null, scanned, invited: 0 };
  }

  // Reuse the JD's live slate when it has one. A second slate may only be born
  // once the previous one was UNLOCKED — the employer paid for that set, so a
  // re-run owes them a new one. Without this a rematch created a parallel slate
  // and outstanding invites had no unambiguous home.
  const live = await db.slate.findFirst({
    where: { jdId: jd.id, status: { in: ["pending_review", "preview"] } },
    orderBy: { deliveredAt: "desc" },
    select: { id: true },
  });
  // Every new slate starts behind the curtain: an admin approves it
  // (lib/admin.ts approveSlate) before the employer hears anything and before
  // any candidate is emailed.
  const slate =
    live ?? (await db.slate.create({ data: { jdId: jd.id, status: "pending_review" } }));

  const invited = await inviteCandidates(jd, slate.id, top);
  await db.jobDescription.update({ where: { id: jd.id }, data: { status: "slate_ready" } });

  return { slateId: slate.id, scanned, invited };
}

/**
 * Persist this run's Stage 0 eliminations so the employer can be told "N were
 * above your budget ceiling" instead of the pool just looking thin. Replaced
 * wholesale on every ranking run — a snapshot of the latest pass, not history.
 * Called by every path that ranks: buildSlate and the consent-refresh cron.
 *
 * null means Stage 0 did not run, and a pass that never filtered has no verdict
 * to store — it must leave the last real pass's evidence alone. Deleting on it
 * meant switching the flag off silently wiped every JD's stored explanation on
 * the next rematch. An empty array IS a verdict ("this pass eliminated nobody")
 * and does clear.
 */
export async function recordEliminations(
  jdId: string,
  eliminated: { profileId: string; reason: string }[] | null,
): Promise<void> {
  if (eliminated === null) return;
  await db.$transaction([
    db.matchElimination.deleteMany({ where: { jdId } }),
    ...(eliminated.length
      ? [
          db.matchElimination.createMany({
            data: eliminated.map((e) => ({ jdId, profileId: e.profileId, reason: e.reason })),
          }),
        ]
      : []),
  ]);
}

/** 32 hex chars (128 bits) — the consent link credential. */
export function newConsentToken(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Invite ranked candidates onto a slate — the ONE place a consent row is born.
 *
 * Everything the employer will eventually see is computed and frozen right
 * here, while the candidate still knows nothing about the job: the profile
 * snapshot, the score, the dimensions and the explanation bullets. Accepting
 * later only copies them onto the slate.
 *
 * That ordering is the whole anti-tailoring guarantee. The consent email and
 * page disclose the JD's must-haves, so any scoring that happened AFTER that
 * disclosure could be gamed by editing a profile inside the 48h window. There
 * is no such scoring event any more.
 *
 * Idempotent per (jdId, profileId): a candidate already invited for this JD
 * keeps their original row, so a re-run never double-invites or re-freezes.
 */
export async function inviteCandidates(
  jd: Jd & { publishedAt?: Date | null },
  slateId: string,
  ranked: RankedCandidate[],
): Promise<number> {
  if (ranked.length === 0) return 0;

  const bullets = explain(jd, ranked);
  const frozenAt = jd.publishedAt ?? new Date();
  let invited = 0;

  for (const [i, r] of ranked.entries()) {
    // Upsert, not create: a rematch after an unlock re-invites a candidate who
    // already has a snapshot for this JD. update:{} keeps the ORIGINAL freeze —
    // re-freezing on a later run would reintroduce the tailoring window.
    const snapshot = await db.profileSnapshot.upsert({
      where: { profileId_jdId: { profileId: r.c.id, jdId: jd.id } },
      create: {
        profileId: r.c.id,
        jdId: jd.id,
        frozenJson: frozenProfileJson(r.c, r.skills, r.engagements, frozenAt),
      },
      update: {},
    });

    const { count } = await db.matchConsent.createMany({
      data: [
        {
          jdId: jd.id,
          profileId: r.c.id,
          slateId,
          snapshotId: snapshot.id,
          score: r.score,
          dims: r.dims,
          reasons: bullets[i] ?? [],
          token: newConsentToken(),
        },
      ],
      skipDuplicates: true,
    });
    invited += count;
  }
  return invited;
}

// Only the fields the explanation actually reads — so the consent-accept path
// can pass a live TalentProfile row without shaping it into a Candidate.
type Ranked = {
  c: {
    headline: string | null;
    city: string | null;
    yearsExperience: number;
    rateUsd: number | null;
    availability: string;
    verifiedTier: string;
  };
  dims: Dims;
  score: number;
  skills: { name: string; normalizedName?: string; confirmed: boolean }[];
};

/**
 * Bullets derived from the stored scores, not written by a model — see
 * explainMatch in scoring.ts for why. Synchronous and offline, so there is no
 * failure mode left to degrade from: a slate can no longer ship unnarrated
 * because an API call timed out.
 */
export function explain(jd: Jd, ranked: Ranked[]): string[][] {
  return ranked.map((r) => explainMatch(jd, { ...r.c, skills: r.skills }, r.dims));
}

import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "./db";
import { blendSimilarity, jdFacetTexts } from "./facets";
import { applyHardFilters, type HardRequirements } from "./filters";
import { embedMany, toVectorLiteral } from "./openai";
import { hardFiltersEnabled } from "./settings";
import {
  MIN_SLATE_SCORE,
  QUALIFY_SCORE,
  QUALIFY_SKILLS,
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
  openToOffers: boolean;
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

/**
 * The JD's Stage 0 requirements: the explicit hardRequirements JSON when the
 * employer set one, else derived from the fields they already filled in. The
 * derivation is what makes the flag meaningful on existing JDs — flipping it
 * on turns every stated budget ceiling into a real ceiling.
 */
export function jdHardRequirements(jd: Jd): HardRequirements {
  const h = (jd.hardRequirements ?? null) as HardRequirements | null;
  if (h && (h.rateMaxUsd != null || h.hoursPerWeekMin != null || h.startWithinDays != null)) {
    return h;
  }
  return { rateMaxUsd: jd.budgetMax, hoursPerWeekMin: jd.hoursPerWeek };
}

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
  /** Stage 0 eliminations from this run — empty when the flag is off. */
  eliminated: { profileId: string; reason: string }[];
}> {
  // Two query vectors, one batch call: the whole-JD role text (also the hnsw
  // pool cut) and the skills-facet text.
  const q = jdFacetTexts(jd);
  const [roleVec, skillsVec] = await embedMany([q.role, q.skills]);

  const rawPool = await db.$queryRawUnsafe<Candidate[]>(
    `SELECT p.id, p."userId", p.headline, p.summary, p.city, p."yearsExperience",
            p."rateUsd", p.availability, p."committedHours", p."verifiedTier", p."lastEditedAt",
            p."shortlistCount", p."lastShownAt", p."openToOffers", p."availabilityConfirmedAt",
            COALESCE(p."embeddingSkills" <=> $2::vector, p.embedding <=> $1::vector) AS dskills,
            COALESCE(p."embeddingExperience" <=> $1::vector, p.embedding <=> $1::vector) AS dexp,
            COALESCE(p."embeddingPrefs" <=> $1::vector, p.embedding <=> $1::vector) AS dprefs
       FROM "TalentProfile" p
       JOIN "user" u ON u.id = p."userId"
      WHERE p."publishedAt" IS NOT NULL
        AND p.visibility = true
        AND p."dormantAt" IS NULL
        AND p.embedding IS NOT NULL
        AND u.status = 'active'
      ORDER BY p.embedding <=> $1::vector
      LIMIT ${CANDIDATE_POOL}`,
    toVectorLiteral(roleVec),
    toVectorLiteral(skillsVec),
  );

  // Stage 0 — hard filters (spec §3), behind the operator flag. Off means the
  // raw pool passes through untouched: today's behaviour exactly.
  const stage0 = (await hardFiltersEnabled())
    ? applyHardFilters(rawPool, jdHardRequirements(jd))
    : { passed: rawPool, aboveBudget: new Set<string>(), eliminated: [] };
  const pool = stage0.passed;

  if (pool.length === 0) return { scanned: rawPool.length, eligible: [], eliminated: stage0.eliminated };

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

  const eligible = pool
    .map((c) => {
      const cSkills = skillsBy.get(c.id) ?? [];
      const cEng = engBy.get(c.id) ?? [];
      const sim = blendSimilarity(c.dskills, c.dexp, c.dprefs);
      const dims = candidateDims(jd, c, cSkills, cEng, sim);
      const fresh = c.openToOffers && (c.availabilityConfirmedAt?.getTime() ?? 0) >= freshCutoff;
      return {
        c,
        dims,
        score: composite(dims, c.verifiedTier === "id_verified"),
        fresh,
        skills: cSkills,
        engagements: cEng,
      };
    })
    // Quality gates eligibility: a candidate rotates only if the composite
    // clears QUALIFY *and* there is real skill overlap for this job. Fairness
    // never places anyone below the bar; padding can't buy a wrong-domain slot.
    .filter((r) => r.score >= QUALIFY_SCORE && r.dims.skills >= QUALIFY_SKILLS)
    // Rotate among the qualified. Fewer prior placements first (shown least),
    // then longest-waiting (older/null lastShownAt), then a light nudge for
    // freshly-confirmed availability, and finally score as the tiebreaker.
    // Because shortlistCount leads, once everyone qualified has been shown they
    // all sit at higher counts and the least-shown return to the front — the
    // cycle resets itself, and anyone placed (or hired) drifts back each turn.
    .sort((a, b) => {
      if (a.c.shortlistCount !== b.c.shortlistCount) return a.c.shortlistCount - b.c.shortlistCount;
      const at = a.c.lastShownAt?.getTime() ?? 0;
      const bt = b.c.lastShownAt?.getTime() ?? 0;
      if (at !== bt) return at - bt;
      if (a.fresh !== b.fresh) return Number(b.fresh) - Number(a.fresh);
      return b.score - a.score;
    });

  return { scanned: rawPool.length, eligible, eliminated: stage0.eliminated };
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
 */
export async function recordEliminations(
  jdId: string,
  eliminated: { profileId: string; reason: string }[],
): Promise<void> {
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

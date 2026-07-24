/**
 * Pure match scoring. No db, no network, no framework — so the evaluation
 * harness and tests can import the exact logic production ranks with.
 */

export type Dims = { skills: number; rate: number; overlap: number; experience: number };

/** Keep every dimension in the 0–100 range the UI and thresholds assume. */
const clamp100 = (n: number): number => Math.max(0, Math.min(100, n));

/**
 * Every dimension shown in the UI actually counts. The previous platform
 * computed four dimensions and multiplied two of them by zero.
 */
export const WEIGHTS = { skills: 0.45, experience: 0.2, rate: 0.2, overlap: 0.15 } as const;

/** A skill backed by a mutual outcome confirmation outweighs a typed claim. */
export const CONFIRMED_SKILL_WEIGHT = 2;

export const normalizeSkill = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9+#. ]/g, "").replace(/\s+/g, " ").trim();

/**
 * Words that carry no matching signal in requirement phrasing. Employers write
 * "US dental practice experience"; the discriminating tokens are dental and
 * practice, not us and experience.
 */
const STOPWORDS = new Set([
  "a", "an", "and", "or", "the", "of", "in", "on", "for", "with", "to", "at",
  "experience", "experienced", "knowledge", "skills", "skill", "ability", "able",
  "strong", "solid", "good", "excellent", "proven", "years", "year", "yrs",
  "plus", "must", "have", "has", "using", "use", "used", "work", "working",
  "us", "usa", "uk", "au", "comfort", "comfortable", "familiar", "familiarity",
]);

const contentTokens = (phrase: string): string[] =>
  normalizeSkill(phrase)
    .split(" ")
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));

/**
 * Two content words match when they are equal or one is a prefix of the other
 * (both ≥ 4 chars). A cheap stemmer: it makes "refunds" meet "refund",
 * "scheduling" meet "schedule", "processing" meet "process" — the wording
 * differences that were silently dropping qualified people. The length floor
 * keeps it from matching on fragments ("art" in "smart").
 */
const STEM_MIN = 4;
const tokenHit = (t: string, corpus: Set<string>): boolean => {
  if (corpus.has(t)) return true;
  if (t.length < STEM_MIN) return false;
  for (const c of corpus) {
    if (c.length >= STEM_MIN && (t.startsWith(c) || c.startsWith(t))) return true;
  }
  return false;
};

/**
 * How well a candidate covers the job's must-haves.
 *
 * Requirements are prose ("US dental practice experience") while skills are
 * tags ("Dentrix"), so exact tag matching alone scores almost everyone near
 * zero. Each requirement is therefore matched against the candidate's whole
 * searchable text — skills, headline, and past role titles — and earns partial
 * credit for the share of its content words that appear.
 *
 * A confirmed skill still outranks a self-reported one: only a mutual outcome
 * confirmation earns the full weight.
 */
export function scoreSkills(
  required: string[],
  candidateSkills: { normalizedName: string; confirmed: boolean }[],
  similarity: number,
  context: { headline?: string | null; roles?: string[] } = {},
): number {
  if (required.length === 0) return clamp100(Math.round(similarity * 100));

  // Confirmed always wins on a duplicate normalizedName, so scoring is
  // deterministic regardless of DB row order if two rows share a name.
  const owned = new Map<string, boolean>();
  for (const s of candidateSkills) {
    owned.set(s.normalizedName, (owned.get(s.normalizedName) ?? false) || s.confirmed);
  }
  const corpus = new Set<string>();
  for (const s of candidateSkills) for (const t of contentTokens(s.normalizedName)) corpus.add(t);
  for (const t of contentTokens(context.headline ?? "")) corpus.add(t);
  for (const role of context.roles ?? []) for (const t of contentTokens(role)) corpus.add(t);

  let earned = 0;
  for (const req of required) {
    const exact = owned.get(normalizeSkill(req));
    if (exact !== undefined) {
      earned += exact ? CONFIRMED_SKILL_WEIGHT : 1;
      continue;
    }
    // Partial credit: how much of this requirement shows up anywhere on the
    // profile, tolerant to plural/gerund wording (see tokenHit). Partial always
    // scores below an exact confirmed match — coverage divides by the confirmed
    // weight — so a loose match lifts a qualified person without outranking a
    // proven one.
    const tokens = contentTokens(req);
    if (tokens.length === 0) continue;
    const hits = tokens.filter((t) => tokenHit(t, corpus)).length;
    earned += (hits / tokens.length) * 1;
  }
  const coverage = earned / (required.length * CONFIRMED_SKILL_WEIGHT);

  // Embedding similarity still contributes — it catches synonyms that share no
  // tokens at all ("QBO" vs "QuickBooks Online").
  return clamp100(Math.round(Math.min(1, coverage * 0.75 + similarity * 0.25) * 100));
}

export function scoreRate(rate: number | null, min: number | null, max: number | null): number {
  if (rate == null || min == null || max == null) return 60;
  if (rate >= min && rate <= max) return 100;

  if (rate < min) {
    // Cheaper is good, but not better than a candidate who priced themselves
    // into the band. Far below usually signals a seniority mismatch rather
    // than a bargain, so the bonus tapers instead of sitting flat at 95.
    const under = (min - rate) / min;
    if (under <= 0.25) return 90;
    if (under <= 0.5) return 80;
    return 70;
  }

  const overBy = (rate - max) / max;
  if (overBy <= 0.15) return 70;
  if (overBy <= 0.4) return 35;
  return 0;
}

export function scoreOverlap(
  availability: string,
  committed: number,
  hoursNeeded: number | null,
): number {
  const free = Math.max(0, 40 - committed);
  if (availability === "booked") return 10;
  if (!hoursNeeded) return availability === "open" ? 100 : 70;
  if (free >= hoursNeeded) return 100;
  return Math.round((free / hoursNeeded) * 100);
}

export function scoreExperience(years: number, confirmedEngagements: number): number {
  const base = Math.min(1, years / 5) * 80;
  const proof = Math.min(20, confirmedEngagements * 10);
  return Math.round(base + proof);
}

/**
 * The "strong match" bar — a candidate below this is padding rather than a
 * genuine match.
 *
 * Returning five names regardless of quality is how job boards waste an
 * employer's time. Against the real pool an Amazon PPC brief surfaced a
 * recruiter and a postal-services generalist at ~59 — one look at that and an
 * employer stops trusting every future slate. A short honest slate, or none at
 * all, is worth more than a padded one.
 *
 * ponytail: currently NOT wired into ranking — rankQualifiedForJd gates on
 * QUALIFY_SCORE/QUALIFY_SKILLS and tiebreaks on raw score. Kept as the intended
 * strong-match threshold; wire it into slate composition only as a deliberate
 * product/matching-tuning decision (see scripts/eval-matching.ts).
 */
export const MIN_SLATE_SCORE = 62;

/**
 * The eligibility bar for rotation, set below the strong-match cutoff.
 *
 * Two thresholds, two jobs. MIN_SLATE_SCORE (62) marks a *strong* match (not
 * currently wired — see its note). QUALIFY (52) is the active bar and marks
 * *eligible*: good enough to put in front of an employer, even if not the
 * single best on paper. Everyone
 * at or above QUALIFY enters the rotation so the same top profiles don't fill
 * every slate — but nobody below it does, so fairness never ships a bad fit.
 *
 * Tuned against the real pool with scripts/eval-matching.ts: the support
 * candidate (Zendesk, live chat, refunds, $9/hr, in-band) lands ~59 on a
 * support brief and now qualifies, while the same profile scores 36–40 on
 * unrelated dental/React/PPC briefs and is still correctly excluded. The
 * ~12-point gap between wrong-domain padding (≤40) and a genuine imperfect
 * match (~59) is where 52 sits.
 */
export const QUALIFY_SCORE = 52;

/**
 * Domain gate: a qualifying candidate must also show real skill overlap, not
 * just a good rate and long tenure. Without this, a wrong-domain profile can
 * pad past QUALIFY on rate + experience + availability alone (the recruiter who
 * surfaced on an Amazon PPC brief). The support example scores skills 54 here;
 * pure padding scores ~10–15. 40 keeps genuine partial matches while cutting
 * off-domain padding — quality gating eligibility, exactly as intended.
 */
export const QUALIFY_SKILLS = 40;

/**
 * Verified identity is a tiebreaker, not a dimension.
 *
 * Kept small on purpose. A bigger bonus would let verification outrank a
 * genuinely better match, which is both bad ranking and — because verification
 * currently costs the worker money — the thing that turns an optional fee into
 * a fee for placement. See docs/research/verification.md.
 */
export const VERIFIED_BONUS = 4;

export function composite(d: Dims, isVerified = false): number {
  const base =
    d.skills * WEIGHTS.skills +
    d.experience * WEIGHTS.experience +
    d.rate * WEIGHTS.rate +
    d.overlap * WEIGHTS.overlap;
  return clamp100(Math.round(base + (isVerified ? VERIFIED_BONUS : 0)));
}

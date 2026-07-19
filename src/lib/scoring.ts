/**
 * Pure match scoring. No db, no network, no framework — so the evaluation
 * harness and tests can import the exact logic production ranks with.
 */

export type Dims = { skills: number; rate: number; overlap: number; experience: number };

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
  if (required.length === 0) return Math.round(similarity * 100);

  const owned = new Map(candidateSkills.map((s) => [s.normalizedName, s.confirmed]));
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
    // Partial credit: how much of this requirement shows up anywhere on the profile.
    const tokens = contentTokens(req);
    if (tokens.length === 0) continue;
    const hits = tokens.filter((t) => corpus.has(t)).length;
    earned += (hits / tokens.length) * 1;
  }
  const coverage = earned / (required.length * CONFIRMED_SKILL_WEIGHT);

  // Embedding similarity still contributes — it catches synonyms that share no
  // tokens at all ("QBO" vs "QuickBooks Online").
  return Math.round(Math.min(1, coverage * 0.75 + similarity * 0.25) * 100);
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
 * Below this, a candidate is padding rather than a match.
 *
 * Returning five names regardless of quality is how job boards waste an
 * employer's time. Against the real pool an Amazon PPC brief surfaced a
 * recruiter and a postal-services generalist at ~59 — one look at that and an
 * employer stops trusting every future slate. A short honest slate, or none at
 * all, is worth more than a padded one.
 */
export const MIN_SLATE_SCORE = 62;

export function composite(d: Dims): number {
  return Math.round(
    d.skills * WEIGHTS.skills +
      d.experience * WEIGHTS.experience +
      d.rate * WEIGHTS.rate +
      d.overlap * WEIGHTS.overlap,
  );
}

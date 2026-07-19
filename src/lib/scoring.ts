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

export function scoreSkills(
  required: string[],
  candidateSkills: { normalizedName: string; confirmed: boolean }[],
  similarity: number,
): number {
  if (required.length === 0) return Math.round(similarity * 100);

  const owned = new Map(candidateSkills.map((s) => [s.normalizedName, s.confirmed]));
  let earned = 0;
  for (const req of required) {
    const confirmed = owned.get(normalizeSkill(req));
    if (confirmed === true) earned += CONFIRMED_SKILL_WEIGHT;
    else if (confirmed === false) earned += 1;
  }
  const exact = earned / (required.length * CONFIRMED_SKILL_WEIGHT);

  // Embedding similarity catches synonyms exact matching misses
  // ("QBO" vs "QuickBooks Online").
  return Math.round(Math.min(1, exact * 0.75 + similarity * 0.25) * 100);
}

export function scoreRate(rate: number | null, min: number | null, max: number | null): number {
  if (rate == null || min == null || max == null) return 60;
  if (rate <= max && rate >= min) return 100;
  if (rate < min) return 95; // under budget is a win for the employer, not a penalty
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

export function composite(d: Dims): number {
  return Math.round(
    d.skills * WEIGHTS.skills +
      d.experience * WEIGHTS.experience +
      d.rate * WEIGHTS.rate +
      d.overlap * WEIGHTS.overlap,
  );
}

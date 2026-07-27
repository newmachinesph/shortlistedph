/**
 * Stage 0 — hard filters (spec §3, engine-plan 1c). Metadata, no vectors,
 * binary: a candidate either passes or is eliminated with a named reason.
 *
 * Pure on purpose: testable, and Phase 4 can push it into SQL without
 * rewriting the logic. Persistence of eliminations lives with the caller.
 *
 * Rate gets the spec's ×1.15 tolerance band: within the band the candidate
 * passes through (the near-miss is a judgment call the employer should make,
 * and explainMatch already tells them "$14/hr, above your $12 ceiling" on that
 * candidate's own card), above it they are eliminated — "$50/hr" and "$5/hr"
 * embed almost identically, which is exactly why rate must be a filter, not a
 * similarity.
 *
 * start_within_days is accepted in the shape for forward-compat with the spec
 * but never eliminates yet: profiles carry no start-date signal to test it
 * against. When Phase 2 adds one, the filter lands here.
 */

import { freeHours } from "./scoring.ts";

export const RATE_TOLERANCE = 1.15;

export type HardRequirements = {
  rateMaxUsd?: number | null;
  hoursPerWeekMin?: number | null;
  startWithinDays?: number | null;
};

export type EliminationReason = "rate_above_ceiling" | "hours_short" | "booked";

export type FilterCandidate = {
  id: string;
  rateUsd: number | null;
  availability: string;
  committedHours: number;
};

export type FilterResult<C extends FilterCandidate> = {
  passed: C[];
  eliminated: { profileId: string; reason: EliminationReason }[];
};

/**
 * The JD's Stage 0 requirements — the single owner of the precedence rule.
 *
 * The stored `hardRequirements` JSON is read for the CEILING ONLY, and its
 * `hoursPerWeekMin` is deliberately dropped.
 *
 * That drop is the fix for a mass elimination that survived two rounds. The JD
 * write path composes the JSON as `{ rateMaxUsd, hoursPerWeekMin:
 * jd.hoursPerWeek }` and this ran before the corrected derivation, returning it
 * wholesale. So on any brief where the employer set a rate ceiling,
 * `hoursPerWeekMin` arrived equal to the hours the employer wants COVERED,
 * while applyHardFilters below reads it as a floor on the candidate's SPARE
 * capacity: a routine 40h brief eliminated every candidate with a single
 * committed hour. Resume parsing writes a non-zero committedHours for most
 * imported profiles, so turning Stage 0 on emptied the pool.
 *
 * hoursPerWeek is a load, never a floor. Short hours already cost overlap
 * score. A real floor has to be STATED by the employer, and nothing in the
 * product asks for one — when a field exists, read it here under its own key,
 * never derived from hoursPerWeek.
 */
export function jdHardRequirements(jd: {
  budgetMax: number | null;
  hardRequirements?: unknown;
}): HardRequirements {
  const stored = (jd.hardRequirements ?? null) as HardRequirements | null;
  return {
    // Only the ceiling is derived, and only when none was stored. This is what
    // makes the flag meaningful on existing JDs: flipping it on turns every
    // stated budget ceiling into a real ceiling.
    rateMaxUsd: stored?.rateMaxUsd ?? jd.budgetMax,
    startWithinDays: stored?.startWithinDays ?? null,
  };
}

export function applyHardFilters<C extends FilterCandidate>(
  candidates: C[],
  hard: HardRequirements | null,
  /**
   * Stop once this many candidates have passed. Callers hand in a DEEPER slice
   * than they need so that filtering reaches past their own cut instead of
   * hollowing it out; stopping here means the eliminations reported are exactly
   * the ones met on the way to a full pool, not everyone in the oversized slice.
   */
  limit = Number.POSITIVE_INFINITY,
): FilterResult<C> {
  const passed: C[] = [];
  const eliminated: { profileId: string; reason: EliminationReason }[] = [];

  if (!hard) return { passed: candidates.slice(0, limit), eliminated };

  for (const c of candidates) {
    if (passed.length >= limit) break;
    if (c.availability === "booked") {
      eliminated.push({ profileId: c.id, reason: "booked" });
      continue;
    }
    if (
      hard.hoursPerWeekMin != null &&
      hard.hoursPerWeekMin > 0 &&
      freeHours(c.committedHours) < hard.hoursPerWeekMin
    ) {
      eliminated.push({ profileId: c.id, reason: "hours_short" });
      continue;
    }
    // A candidate with no stated rate is never eliminated on rate — the rate
    // dimension already scores the missing number down; a hard filter would
    // punish honesty about "negotiable" harder than an inflated lowball.
    if (
      hard.rateMaxUsd != null &&
      hard.rateMaxUsd > 0 &&
      c.rateUsd != null &&
      c.rateUsd > hard.rateMaxUsd * RATE_TOLERANCE
    ) {
      eliminated.push({ profileId: c.id, reason: "rate_above_ceiling" });
      continue;
    }
    passed.push(c);
  }

  return { passed, eliminated };
}

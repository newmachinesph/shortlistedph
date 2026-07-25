/**
 * Stage 0 — hard filters (spec §3, engine-plan 1c). Metadata, no vectors,
 * binary: a candidate either passes or is eliminated with a named reason.
 *
 * Pure on purpose: testable, and Phase 4 can push it into SQL without
 * rewriting the logic. Persistence of eliminations lives with the caller.
 *
 * Rate gets the spec's ×1.15 tolerance band: within the band the candidate
 * passes through TAGGED (the near-miss is a judgment call the employer should
 * see), above it they are eliminated — "$50/hr" and "$5/hr" embed almost
 * identically, which is exactly why rate must be a filter, not a similarity.
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
  /** Candidates inside the rate tolerance band — passed, but flagged. */
  aboveBudget: Set<string>;
  eliminated: { profileId: string; reason: EliminationReason }[];
};

export function applyHardFilters<C extends FilterCandidate>(
  candidates: C[],
  hard: HardRequirements | null,
): FilterResult<C> {
  const passed: C[] = [];
  const aboveBudget = new Set<string>();
  const eliminated: { profileId: string; reason: EliminationReason }[] = [];

  if (!hard) return { passed: candidates, aboveBudget, eliminated };

  for (const c of candidates) {
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
    if (hard.rateMaxUsd != null && hard.rateMaxUsd > 0 && c.rateUsd != null) {
      if (c.rateUsd > hard.rateMaxUsd * RATE_TOLERANCE) {
        eliminated.push({ profileId: c.id, reason: "rate_above_ceiling" });
        continue;
      }
      if (c.rateUsd > hard.rateMaxUsd) aboveBudget.add(c.id);
    }
    passed.push(c);
  }

  return { passed, aboveBudget, eliminated };
}

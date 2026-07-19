// Pure serialization — no secrets, no db, so it stays testable outside Next.
import type { Dims } from "./scoring.ts";
import { initials } from "./format.ts";

/**
 * The paywall lives HERE, not in CSS.
 *
 * A locked slate must never put a name, contact detail, employer name, or
 * resume key into the response body — blurring in the browser is decoration,
 * and anyone can open devtools. `maskEntry` is the only sanctioned way to
 * serialize a slate entry for an employer.
 */

export type FrozenProfile = {
  userId: string;
  headline: string | null;
  summary: string | null;
  city: string | null;
  yearsExperience: number;
  rateUsd: number | null;
  availability: string;
  committedHours: number;
  verifiedTier: string;
  profileStableDays: number;
  skills: { name: string; confirmed: boolean }[];
  engagements: { role: string; company: string; span: string; outcome: string }[];
};

export type SlateEntryInput = {
  id: string;
  rank: number;
  score: number;
  dims: Dims;
  reasons: string[];
  snapshot: { id: string; frozenJson: unknown };
  candidateName: string | null;
};

export type MaskedEntry = {
  id: string;
  rank: number;
  score: number;
  dims: Dims;
  reasons: string[];
  locked: boolean;
  initials: string;
  headline: string | null;
  city: string | null;
  yearsExperience: number;
  rateUsd: number | null;
  availability: string;
  verified: boolean;
  profileStableDays: number;
  skills: { name: string; confirmed: boolean }[];
  // Only present when unlocked:
  name?: string;
  snapshotId?: string;
  summary?: string | null;
  engagements?: FrozenProfile["engagements"];
};

export function maskEntry(entry: SlateEntryInput, unlocked: boolean): MaskedEntry {
  const p = entry.snapshot.frozenJson as FrozenProfile;

  const base: MaskedEntry = {
    id: entry.id,
    rank: entry.rank,
    score: entry.score,
    dims: entry.dims,
    reasons: entry.reasons,
    locked: !unlocked,
    initials: initials(entry.candidateName),
    headline: p.headline,
    city: p.city,
    yearsExperience: p.yearsExperience,
    rateUsd: p.rateUsd,
    availability: p.availability,
    verified: p.verifiedTier === "id_verified",
    profileStableDays: p.profileStableDays,
    // Skills and scores are the value proposition of the free preview — they
    // let an employer judge match quality without identifying anyone.
    skills: p.skills,
  };

  if (!unlocked) return base;

  return {
    ...base,
    name: entry.candidateName ?? "Unknown",
    snapshotId: entry.snapshot.id,
    summary: p.summary,
    engagements: p.engagements,
  };
}

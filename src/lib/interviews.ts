import "server-only";
import { db } from "./db";

/**
 * Pay-per-interview: an employer picks a vetted interviewer to run a recorded
 * 30-minute interview of one shortlisted candidate, and gets back a structured
 * assessment on our template.
 *
 * Ordering is consent-first on purpose. The candidate agrees to being
 * interviewed and recorded BEFORE the employer is charged, so a declined
 * request never took money — which is the only reason this works without the
 * refund machinery the platform does not have.
 *
 *   requested → consented → paid → scheduled → recorded → reported
 *             ↘ declined (candidate said no, nothing charged)
 *   any active state → cancelled
 */

/**
 * The employer pays a FLAT price per interview, the same for every candidate
 * and every interviewer. The interviewer's own $5–10 rate is an internal
 * mandate — it is what WE pay them, never shown to the employer, and the
 * difference is our margin (covers the PayPal payout cost and leaves a spread).
 * Keeping one public number means we never explain, or have to defend, why one
 * candidate's interview would cost more than another's.
 */
export const INTERVIEW_PRICE_USD = 15;

export const INTERVIEWER_RATE_MIN = 5;
export const INTERVIEWER_RATE_MAX = 10;
export const INTERVIEW_DURATION_MINUTES = 30;

/** What the employer pays — flat, regardless of which interviewer runs it. */
export function employerPrice(): number {
  return INTERVIEW_PRICE_USD;
}

// The assessment template. Fixed fields so every report renders identically
// and can be compared across candidates — the interviewer fills it, they do
// not design it.
export const RECOMMENDATIONS = ["strong_yes", "yes", "lean_yes", "no"] as const;
export type Recommendation = (typeof RECOMMENDATIONS)[number];

export const RECOMMENDATION_LABEL: Record<Recommendation, string> = {
  strong_yes: "Strong yes",
  yes: "Yes",
  lean_yes: "Lean yes",
  no: "No",
};

export const INTERVIEW_STATUSES = [
  "requested",
  "consented",
  "declined",
  "paid",
  "scheduled",
  "recorded",
  "reported",
  "cancelled",
] as const;
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

/** Money is owed to the platform once paid, and to the interviewer once the
 * assessment is in — nothing pays out for an interview that never happened. */
export const PAYABLE_TO_INTERVIEWER: InterviewStatus = "reported";

/** Only these entries can be interviewed: the employer has already unlocked
 * the slate, so the candidate is someone they committed to seeing. */
export async function interviewableEntry(slateEntryId: string, employerId: string) {
  return db.slateEntry.findFirst({
    where: {
      id: slateEntryId,
      slate: { status: "unlocked", jd: { employerId } },
    },
    include: {
      snapshot: { select: { profileId: true, frozenJson: true, profile: { select: { userId: true } } } },
    },
  });
}

/** The pool an employer chooses from — active interviewers only, never the
 * pending or paused ones, and never exposed as a public directory. */
export async function activeInterviewers() {
  return db.interviewer.findMany({
    where: { status: "active" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      bio: true,
      expertise: true,
      languages: true,
      yearsExperience: true,
      rateUsd: true,
      avatarKey: true,
      user: { select: { name: true } },
    },
  });
}

export async function getInterviewer(userId: string) {
  return db.interviewer.findUnique({ where: { userId } });
}

/** Public-safe pool stats for the marketing page — counts and ranges only,
 * never names. */
export async function interviewerPoolStats() {
  const active = await db.interviewer.findMany({
    where: { status: "active" },
    select: { yearsExperience: true, expertise: true },
  });
  const domains = new Set<string>();
  for (const i of active) for (const e of i.expertise) domains.add(e.toLowerCase());
  const avgYears =
    active.length > 0
      ? Math.round(active.reduce((n, i) => n + i.yearsExperience, 0) / active.length)
      : 0;
  return { count: active.length, domains: domains.size, avgYears };
}

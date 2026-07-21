import "server-only";
import { db } from "./db";
import { notify } from "./notify";
import { HttpError } from "./session";

/**
 * An employer picks a vetted interviewer to run a recorded 30-minute interview
 * of one shortlisted candidate, and gets back a structured assessment on our
 * template. Each interview costs ONE interview credit, bought ahead (see
 * lib/payments.ts) or granted by an admin, and spent at the confirm step.
 *
 * Ordering is consent-first on purpose. The candidate agrees to being
 * interviewed and recorded BEFORE a credit is spent to confirm, so a declined
 * request never cost anything — which is the only reason this works without the
 * refund machinery the platform does not have.
 *
 *   requested → consented → paid → scheduled → recorded → reported
 *             ↘ declined (candidate said no, nothing spent)
 *   any active state → cancelled
 *
 * ("paid" is kept as the post-confirm status name for continuity — it now means
 * "a credit was spent to confirm", not an inline charge.)
 */

/**
 * One interview credit is worth a FLAT price, the same for every candidate and
 * every interviewer — this is the single source of that price (payments.ts
 * prices the interview_single product from it). The interviewer's own $5–10
 * rate is an internal mandate — what WE pay them, never shown to the employer,
 * and the difference is our margin. Keeping one public number means we never
 * explain, or defend, why one candidate's interview would cost more.
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

/**
 * Confirm a consented interview by spending ONE interview credit.
 *
 * Replaces the old inline per-interview PayPal charge: the employer buys
 * interview credits ahead (or an admin grants them) and one is spent here to
 * move the interview consented → paid. Consent-first is preserved — this only
 * runs once the candidate has agreed, so a declined request still spends
 * nothing.
 *
 * Race safety, both directions:
 *  - Last-credit across two DIFFERENT interviews: the conditional decrement
 *    (`interviewCredits: { gte: 1 }`) means the second confirm updates zero
 *    rows and gets 402 — the balance can never go negative.
 *  - Double-confirm of the SAME interview: the status guard advances only from
 *    "consented"; the loser updates zero rows and throws, rolling the whole
 *    transaction back so its decrement is returned. A double-confirm spends at
 *    most one credit.
 */
export async function confirmInterview(args: {
  actorId: string;
  employerId: string;
  interviewId: string;
}): Promise<{ status: "paid" }> {
  const interview = await db.interview.findUnique({
    where: { id: args.interviewId },
    select: { id: true, employerId: true, status: true },
  });
  if (!interview || interview.employerId !== args.employerId) {
    throw new HttpError(404, "Interview not found");
  }
  if (interview.status !== "consented") {
    throw new HttpError(409, "This interview is not awaiting confirmation");
  }

  const outcome = await db.$transaction(async (tx) => {
    const spent = await tx.employerAccount.updateMany({
      where: { id: args.employerId, interviewCredits: { gte: 1 } },
      data: { interviewCredits: { decrement: 1 } },
    });
    if (spent.count === 0) return "no_credits" as const;

    const advanced = await tx.interview.updateMany({
      where: { id: interview.id, status: "consented" },
      data: { status: "paid" },
    });
    // Zero means another confirm already advanced it — throw so the decrement
    // above rolls back rather than vanishing a credit for nothing.
    if (advanced.count === 0) {
      throw new HttpError(409, "This interview is no longer awaiting confirmation");
    }

    await tx.auditLog.create({
      data: {
        actorId: args.actorId,
        action: "interview.confirmed",
        target: interview.id,
        meta: { spent: "1 interview credit" },
      },
    });
    return "confirmed" as const;
  });

  if (outcome === "no_credits") {
    throw new HttpError(402, "No interview credits — buy interview credits first");
  }

  await notifyInterviewConfirmed(interview.id);
  return { status: "paid" };
}

/** Post-commit, best-effort: tell the interviewer they have a confirmed
 * assignment and the candidate the interview is booked. */
async function notifyInterviewConfirmed(interviewId: string) {
  try {
    const iv = await db.interview.findUnique({
      where: { id: interviewId },
      select: {
        talentUserId: true,
        interviewer: { select: { userId: true } },
        employer: { select: { companyName: true } },
      },
    });
    if (!iv) return;

    await notify({
      userId: iv.interviewer.userId,
      type: "interview_assigned",
      payload: { interviewId, company: iv.employer.companyName },
    });
    await notify({
      userId: iv.talentUserId,
      type: "interview_booked",
      payload: { interviewId, company: iv.employer.companyName },
    });
  } catch (e) {
    console.error("[interview] post-confirm side effects failed", e);
  }
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

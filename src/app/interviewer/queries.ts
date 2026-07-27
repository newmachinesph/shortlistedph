import "server-only";
import { db } from "@/lib/db";
import { HttpError, requireUser } from "@/lib/session";
import { getInterviewer, INTERVIEWER_RATE_MAX, INTERVIEWER_RATE_MIN } from "@/lib/interviews";

/**
 * Server reads and guards for the interviewer portal. Shared by the portal
 * pages and the /api/interviewer routes so access is decided in one place.
 *
 * Every assignment lookup filters on `interviewerId` in the WHERE clause — an
 * interviewer's query for an interview that isn't theirs returns nothing, so a
 * 404 never leaks that the row exists. There are no post-fetch ownership checks.
 */

/** Rate is the interviewer's own number but the platform bounds it. Clamp, don't reject. */
export function clampRate(rateUsd: number): number {
  return Math.min(INTERVIEWER_RATE_MAX, Math.max(INTERVIEWER_RATE_MIN, rateUsd));
}

/** These two states can run assignments and file reports. "pending" cannot. */
const ACTING_STATUSES = ["active", "paused"];

/** API guard: the caller must own an Interviewer row that is cleared to act. */
export async function requireActingInterviewer() {
  const user = await requireUser();
  const interviewer = await getInterviewer(user.id);
  if (!interviewer) throw new HttpError(403, "You are not an interviewer");
  if (!ACTING_STATUSES.includes(interviewer.status)) {
    throw new HttpError(403, "Your interviewer account is not active");
  }
  return { user, interviewer };
}

/**
 * Interviews assigned to this interviewer that still need work: schedule the
 * call (paid), run and upload it (scheduled), then file the report (recorded).
 * "recorded" stays here so the assessment — the last step — has somewhere to
 * live before the interview moves to Earnings at "reported".
 */
export async function listAssignments(interviewerId: string) {
  return db.interview.findMany({
    where: { interviewerId, status: { in: ["paid", "scheduled", "recorded"] } },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      meetingUrl: true,
      recordingKey: true,
      suggestedQuestions: true,
      employerNotes: true,
      // The interviewer is told who they are interviewing — they can't run the
      // call blind. Name comes from the live talent user, the rest from the
      // frozen snapshot the employer was shown.
      talent: { select: { name: true } },
      employer: { select: { companyName: true } },
      slateEntry: { select: { snapshot: { select: { frozenJson: true } } } },
    },
  });
}

/** Reported interviews (money earned) plus the payout ledger. */
export async function listEarnings(interviewerId: string) {
  const [reportedRaw, payoutsRaw] = await Promise.all([
    db.interview.findMany({
      where: { interviewerId, status: "reported" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        interviewerPayoutUsd: true,
        payoutId: true,
        createdAt: true,
        talent: { select: { name: true } },
        employer: { select: { companyName: true } },
      },
    }),
    db.interviewerPayout.findMany({
      where: { interviewerId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const reported = reportedRaw.map((i) => ({ ...i, interviewerPayoutUsd: Number(i.interviewerPayoutUsd) }));
  const payouts = payoutsRaw.map((p) => ({ ...p, amount: Number(p.amount) }));

  const totalEarned = reported.reduce((n, i) => n + i.interviewerPayoutUsd, 0);
  const totalPaid = payouts
    .filter((p) => p.status === "paid")
    .reduce((n, p) => n + p.amount, 0);
  // Earned but not yet claimed by any payout — the number a request would be
  // for. Read off payoutId, the same column the claim writes, so the figure on
  // screen and the figure the request creates can never disagree.
  const owed = round2(reported.filter((i) => !i.payoutId).reduce((n, i) => n + i.interviewerPayoutUsd, 0));

  return {
    reported,
    payouts,
    totalEarned,
    totalPaid,
    owed,
    hasPendingRequest: payouts.some((p) => p.status === "pending"),
  };
}

// ─── Payouts ──────────────────────────────────────────────────────────────

/** What the admin settlement route already accepts — one list, not two. */
export const PAYOUT_METHODS = ["gcash", "bank"] as const;
export type PayoutMethod = (typeof PAYOUT_METHODS)[number];

export function isPayoutMethod(m: string | null): m is PayoutMethod {
  return PAYOUT_METHODS.includes(m as PayoutMethod);
}

export function hasPayoutDetails(r: {
  payoutMethod: string | null;
  payoutAccountName: string | null;
  payoutAccountNumber: string | null;
}) {
  return isPayoutMethod(r.payoutMethod) && Boolean(r.payoutAccountName) && Boolean(r.payoutAccountNumber);
}

/** Two decimal places, so three $12.33 interviews do not become 36.99000000000001. */
function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Creates the pending InterviewerPayout covering every reported interview this
 * interviewer is owed for that no payout has claimed yet, and links them.
 *
 * The amount is recomputed here from the interviews themselves — no caller ever
 * supplies one. `payoutId: null` in the WHERE is the claim: two concurrent
 * requests (an operator and the interviewer, or one double-click) cannot both
 * cover the same work, because the loser links zero rows and rolls back.
 */
export async function claimUnpaidInterviews(
  interviewerId: string,
  method: PayoutMethod,
  note?: string,
) {
  const interviews = await db.interview.findMany({
    where: { interviewerId, status: "reported", payoutId: null },
    select: { id: true, interviewerPayoutUsd: true },
  });
  if (interviews.length === 0) {
    throw new HttpError(409, "No unpaid reported interviews for this interviewer");
  }

  const amount = round2(interviews.reduce((n, i) => n + Number(i.interviewerPayoutUsd), 0));
  const ids = interviews.map((i) => i.id);

  const payout = await db.$transaction(async (tx) => {
    const p = await tx.interviewerPayout.create({
      data: { interviewerId, amount, currency: "USD", method, note, status: "pending" },
    });
    const claimed = await tx.interview.updateMany({
      where: { id: { in: ids }, payoutId: null },
      data: { payoutId: p.id },
    });
    if (claimed.count !== ids.length) {
      throw new HttpError(409, "Another payout claimed these interviews — reload and try again");
    }
    return p;
  });

  return { payout, amount, count: ids.length };
}

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

  return { reported, payouts, totalEarned, totalPaid };
}

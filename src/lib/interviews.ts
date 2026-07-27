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

    // Mark WHICH credit was spent. The balance column alone cannot be
    // reconciled: without this the entitlement ledger showed every interview
    // credit as forever unspent, so sold-vs-spent never added up and a refund
    // could not tell a used credit from an unused one.
    const ent = await tx.entitlement.findFirst({
      where: {
        employerId: args.employerId,
        kind: "interview_credit",
        spentOnSlateId: null,
        spentOnInterviewId: null,
        revokedAt: null,
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (ent) {
      await tx.entitlement.update({
        where: { id: ent.id },
        data: { spentOnInterviewId: interview.id },
      });
    } else {
      // Balance said yes, ledger had nothing to spend — a drift worth seeing.
      console.warn(
        `[interview] employer ${args.employerId} spent an interview credit with no unspent entitlement row`,
      );
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

/**
 * Fully delivered: the assessment is in, so the interviewer is owed and the
 * credit bought exactly what it was for. Cancelling can undo neither.
 *
 * "recorded" is deliberately NOT here. It used to be, and that made it a
 * permanent trap: the call ran but the report — the thing the employer actually
 * bought — never arrived, nobody could cancel it, no cron swept it, and
 * revoking the interviewer stranded it forever. Cancelling one takes nothing
 * from the interviewer: PAYABLE_TO_INTERVIEWER is "reported", so a
 * recorded-only interview was never in the owed query to begin with. Paying for
 * the call anyway is an ad-hoc decision, not a reason to bury the employer's
 * credit inside a dead row.
 */
const DELIVERED: InterviewStatus[] = ["reported"];
/**
 * Half-delivered: the call ran, the assessment did not arrive. An operator — or
 * the interview-expiry cron, which passes no employerId — may cancel it. The
 * employer may not: they got a real interview, and undoing it unilaterally is
 * not theirs to do.
 */
const HALF_DELIVERED: InterviewStatus[] = ["recorded"];
/** Already over. Exported so the admin UI decides whether to offer a cancel
 * from the same list the API enforces, rather than a second copy of it. */
export const CLOSED: InterviewStatus[] = ["declined", "cancelled"];
/** A credit was spent to reach these, so cancelling returns it — "recorded"
 * included, where the credit bought a report that never came. */
const CREDIT_SPENT: InterviewStatus[] = ["paid", "scheduled", "recorded"];

/**
 * Whether the interview credit spent on this interview was bought with money
 * that has since been handed back.
 *
 * Refunding revokes only UNSPENT entitlements — a spent one is left alone
 * because the work it bought cannot be un-done. An interview cancelled
 * afterwards would otherwise return that credit to the balance, re-issuing a
 * purchase that no longer exists.
 *
 * Lives here rather than in fulfillment.ts: that module imports payments.ts,
 * which imports this one for the interview price, so the reverse import closes
 * a cycle that breaks the build.
 */
async function wasInterviewCreditRefunded(interviewId: string): Promise<boolean> {
  const spent = await db.entitlement.findFirst({
    where: { spentOnInterviewId: interviewId },
    select: { source: true },
  });
  if (!spent) return false;

  const payment = await db.payment.findUnique({
    where: { providerRef: spent.source },
    select: { status: true },
  });
  return payment?.status === "refunded";
}

/**
 * States cancelInterview will accept. Exported so the admin UI offers the
 * action exactly where the API allows it, instead of restating the rule and
 * drifting from it.
 */
export const CANCELLABLE: readonly InterviewStatus[] = INTERVIEW_STATUSES.filter(
  (s) => !CLOSED.includes(s) && !DELIVERED.includes(s),
);

/**
 * Cancel an interview and return the credit if one was spent.
 *
 * The only cancel path used to be the employer's, and it refused once the
 * interview reached "paid" — so a confirmed interview whose interviewer went
 * silent was unfixable by anyone: credit gone, no refund, no admin lever, no
 * timeout. Admin can now cancel at any live stage; the employer keeps their
 * pre-delivery window.
 *
 * Returning the credit restores BOTH sides of the ledger — balance and the
 * entitlement row — so the reconciliation invariant still holds afterwards.
 */
export async function cancelInterview(args: {
  actorId: string;
  interviewId: string;
  /** Set for an employer-initiated cancel; omitted for admin. */
  employerId?: string;
  reason?: string;
}): Promise<{ status: "cancelled"; creditReturned: boolean }> {
  const interview = await db.interview.findUnique({
    where: { id: args.interviewId },
    select: { id: true, employerId: true, status: true, talentUserId: true, interviewer: { select: { userId: true } } },
  });
  if (!interview) throw new HttpError(404, "Interview not found");
  if (args.employerId && interview.employerId !== args.employerId) {
    throw new HttpError(404, "Interview not found");
  }

  const status = interview.status as InterviewStatus;
  if (CLOSED.includes(status)) throw new HttpError(409, "This interview is already closed");
  // Delivered work is nobody's to cancel — not even an operator's. The
  // interviewer ran the call and uploaded the recording; cancelling drops the
  // row out of the owed query and their earnings simply vanish, with the
  // employer getting nothing back either (no credit was returnable at this
  // stage). Reversing delivered work needs a decision about who eats the cost,
  // which is a refund conversation, not a status flip.
  if (DELIVERED.includes(status)) {
    throw new HttpError(
      409,
      "This interview has already been carried out — cancelling it would erase the interviewer's earnings. Handle it as a refund instead.",
    );
  }
  // The call ran. An operator can still close this out (and the credit comes
  // back, because the assessment never arrived); the employer cannot do it on
  // their own. args.employerId is set only on the employer-initiated path.
  if (args.employerId && HALF_DELIVERED.includes(status)) {
    throw new HttpError(
      409,
      "This interview has already been carried out. Contact support if the assessment hasn't arrived.",
    );
  }

  // A credit whose purchase was refunded is not the employer's to get back.
  // Without this check, buying a pack, confirming an interview, refunding the
  // pack and then cancelling handed back a credit backed by money that had
  // already gone home.
  const creditReturned =
    CREDIT_SPENT.includes(status) && !(await wasInterviewCreditRefunded(interview.id));

  await db.$transaction(async (tx) => {
    const { count } = await tx.interview.updateMany({
      where: { id: interview.id, status },
      data: { status: "cancelled" },
    });
    if (count === 0) throw new HttpError(409, "This interview just changed state — reload and try again");

    if (creditReturned) {
      await tx.employerAccount.update({
        where: { id: interview.employerId },
        data: { interviewCredits: { increment: 1 } },
      });
      // Free the exact row that was spent, so it becomes spendable again
      // rather than leaving the ledger one short of the balance.
      const spent = await tx.entitlement.findFirst({
        where: { spentOnInterviewId: interview.id, revokedAt: null },
        select: { id: true },
      });
      if (spent) {
        await tx.entitlement.update({ where: { id: spent.id }, data: { spentOnInterviewId: null } });
      }
    }

    await tx.auditLog.create({
      data: {
        actorId: args.actorId,
        action: args.employerId ? "interview.cancelled" : "admin.interview.cancelled",
        target: interview.id,
        meta: { from: status, reason: args.reason ?? null, creditReturned },
      },
    });
  });

  // Post-commit, best-effort. Everyone attached to a cancelled interview needs
  // to hear about it — an interviewer left holding a cancelled assignment used
  // to find out only by showing up.
  try {
    const employer = await db.employerAccount.findUnique({
      where: { id: interview.employerId },
      select: { userId: true },
    });
    const payload = { interviewId: interview.id, reason: args.reason ?? "" };
    await Promise.all([
      employer ? notify({ userId: employer.userId, type: "interview_cancelled", payload }) : null,
      notify({ userId: interview.talentUserId, type: "interview_cancelled", payload }),
      notify({ userId: interview.interviewer.userId, type: "interview_cancelled", payload }),
      employer && creditReturned
        ? notify({ userId: employer.userId, type: "interview_credit_returned", payload })
        : null,
    ]);
  } catch (e) {
    console.error("[interview] cancel notifications failed", e);
  }

  return { status: "cancelled", creditReturned };
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

/**
 * Everything the candidate is entitled to see about interviews of themselves.
 *
 * Lives here rather than inside the page so the access rule has one owner and
 * can be tested: `talentUserId` is in the WHERE, never a post-fetch check, so
 * another candidate's interview is not merely hidden — it is never fetched.
 *
 * The assessment and the recording are included because they are about this
 * person. Both were reachable by the employer who bought them and by an admin,
 * and by nobody else; the candidate consented to being recorded and could not
 * read a word of the result. `recordingKey` is reduced to a boolean here — the
 * object key never reaches the browser, the presigning route handles that.
 */
export async function talentInterviews(userId: string) {
  const interviews = await db.interview.findMany({
    where: { talentUserId: userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      meetingUrl: true,
      assessment: true,
      recordingKey: true,
      employer: { select: { companyName: true } },
    },
  });
  return interviews.map((i) => ({
    id: i.id,
    status: i.status,
    scheduledAt: i.scheduledAt,
    meetingUrl: i.meetingUrl,
    company: i.employer.companyName,
    assessment: i.assessment,
    hasRecording: Boolean(i.recordingKey),
  }));
}

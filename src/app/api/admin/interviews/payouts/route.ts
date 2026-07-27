import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, parseBody } from "@/lib/api";
import { HttpError, requireAdmin } from "@/lib/session";
import { PAYOUT_METHODS, claimUnpaidInterviews, hasPayoutDetails } from "@/app/interviewer/queries";

const Body = z.object({
  interviewerId: z.string().min(1),
  method: z.enum(PAYOUT_METHODS),
  note: z.string().max(500).optional(),
});

/**
 * Create an InterviewerPayout covering every reported interview this
 * interviewer is owed for and that no payout has claimed yet. Currency is USD —
 * the amount earned. It is settled to PHP by hand at settle time; there is no FX
 * rate in this system. Linking the interviews (Interview.payoutId) is what marks
 * them covered, so a second create can never double-pay the same interview.
 */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const { interviewerId, method, note } = await parseBody(req, Body);

    // A payout with no destination is money the operator cannot actually send.
    // The interviewer supplies theirs on their own profile; refusing here is
    // what makes that field load-bearing instead of decorative.
    const interviewer = await db.interviewer.findUnique({
      where: { id: interviewerId },
      select: { payoutMethod: true, payoutAccountName: true, payoutAccountNumber: true },
    });
    if (!interviewer) throw new HttpError(404, "Interviewer not found");
    if (!hasPayoutDetails(interviewer)) {
      throw new HttpError(409, "This interviewer has not added payout details yet");
    }

    // The claim (and its race safety) is shared with the interviewer's own
    // request route — one definition of "what a payout covers".
    const { payout, amount, count } = await claimUnpaidInterviews(interviewerId, method, note);

    await db.auditLog.create({
      data: {
        actorId: admin.id,
        action: "interviewer_payout_created",
        target: payout.id,
        meta: { interviewerId, amount, currency: "USD", method, interviews: count },
      },
    });

    return ok({ id: payout.id, amount });
  } catch (e) {
    return fail(e);
  }
}

import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/session";
import {
  PAYOUT_METHODS,
  claimUnpaidInterviews,
  isPayoutMethod,
  requireActingInterviewer,
} from "@/app/interviewer/queries";

/**
 * Where the interviewer's earnings go, and the request that asks for them.
 * Mirrors the affiliate side (lib/referral.ts savePayoutDetails/requestPayout):
 * the account details are the interviewer's own to write, the amount is never
 * one of them — it is recomputed from the interviews the payout covers.
 *
 * The account number is never logged, never returned in full by any read, and
 * never leaves this file except to the row.
 */
const Details = z.object({
  method: z.enum(PAYOUT_METHODS),
  accountName: z.string().trim().min(2).max(120),
  accountNumber: z.string().trim().min(4).max(64),
});

export async function PUT(req: Request) {
  try {
    const { interviewer } = await requireActingInterviewer();
    const d = await parseBody(req, Details);

    await db.interviewer.update({
      where: { id: interviewer.id },
      data: {
        payoutMethod: d.method,
        payoutAccountName: d.accountName,
        payoutAccountNumber: d.accountNumber,
      },
    });

    return ok({ method: d.method });
  } catch (e) {
    return fail(e);
  }
}

/** Ask to be paid everything reported and unclaimed. Amount comes from the rows. */
export async function POST() {
  try {
    const { interviewer } = await requireActingInterviewer();

    const method = interviewer.payoutMethod;
    // Re-checked rather than trusted: the column is free text, and a value this
    // build no longer settles must send the interviewer back to the form rather
    // than create a pending payout pointing nowhere.
    if (!isPayoutMethod(method) || !interviewer.payoutAccountNumber || !interviewer.payoutAccountName) {
      throw new HttpError(422, "Add your payout details before requesting a payout");
    }

    const pending = await db.interviewerPayout.findFirst({
      where: { interviewerId: interviewer.id, status: "pending" },
      select: { id: true },
    });
    if (pending) throw new HttpError(409, "You already have a payout request waiting");

    const { amount, count } = await claimUnpaidInterviews(interviewer.id, method);

    return ok({ amount, currency: "USD", interviews: count }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}

import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, parseBody } from "@/lib/api";
import { HttpError, requireAdmin } from "@/lib/session";

const Body = z.object({
  interviewerId: z.string().min(1),
  method: z.enum(["gcash", "bank"]),
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

    const interviews = await db.interview.findMany({
      where: { interviewerId, status: "reported", payoutId: null },
      select: { id: true, interviewerPayoutUsd: true },
    });
    if (interviews.length === 0) throw new HttpError(409, "No unpaid reported interviews for this interviewer");

    const amount =
      Math.round(interviews.reduce((n, i) => n + Number(i.interviewerPayoutUsd), 0) * 100) / 100;
    const ids = interviews.map((i) => i.id);

    const payout = await db.$transaction(async (tx) => {
      const p = await tx.interviewerPayout.create({
        data: { interviewerId, amount, currency: "USD", method, note, status: "pending" },
      });
      await tx.interview.updateMany({ where: { id: { in: ids } }, data: { payoutId: p.id } });
      return p;
    });

    await db.auditLog.create({
      data: {
        actorId: admin.id,
        action: "interviewer_payout_created",
        target: payout.id,
        meta: { interviewerId, amount, currency: "USD", method, interviews: ids.length },
      },
    });

    return ok({ id: payout.id, amount });
  } catch (e) {
    return fail(e);
  }
}

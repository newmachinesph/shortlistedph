import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, parseBody } from "@/lib/api";
import { HttpError, requireAdmin } from "@/lib/session";

const Body = z.object({
  status: z.enum(["paid", "rejected"]),
  reference: z.string().max(120).optional(),
  note: z.string().max(500).optional(),
});

/** Settle one pending InterviewerPayout. `id` is InterviewerPayout.id. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const { status, reference, note } = await parseBody(req, Body);

    const payout = await db.interviewerPayout.findUnique({ where: { id } });
    if (!payout) throw new HttpError(404, "Payout not found");
    if (payout.status !== "pending") throw new HttpError(409, `Payout is already ${payout.status}`);
    if (status === "paid" && !reference) {
      throw new HttpError(422, "A transfer reference is required to mark a payout paid");
    }

    await db.$transaction(async (tx) => {
      await tx.interviewerPayout.update({
        where: { id },
        data: { status, reference, note, paidAt: status === "paid" ? new Date() : null },
      });
      // Rejecting releases the interviews this request had claimed so they show
      // as owed again and can be re-covered. Marking it paid leaves them linked.
      if (status === "rejected") {
        await tx.interview.updateMany({ where: { payoutId: id }, data: { payoutId: null } });
      }
    });

    await db.auditLog.create({
      data: {
        actorId: admin.id,
        action: `interviewer_payout_${status}`,
        target: id,
        meta: { amount: payout.amount, currency: payout.currency, method: payout.method, reference, note },
      },
    });

    return ok({ id, status });
  } catch (e) {
    return fail(e);
  }
}

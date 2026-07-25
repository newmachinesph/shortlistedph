import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, parseBody } from "@/lib/api";
import { mail } from "@/lib/email";
import { HttpError, requireAdmin } from "@/lib/session";

const Body = z.object({
  status: z.enum(["paid", "rejected"]),
  reference: z.string().max(120).optional(),
  note: z.string().max(500).optional(),
});

/** Settle a referral payout. `id` is the ReferralPayout id. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const { status, reference, note } = await parseBody(req, Body);

    const payout = await db.referralPayout.findUnique({
      where: { id },
      include: { user: { select: { email: true, name: true } } },
    });
    if (!payout) throw new HttpError(404, "Payout not found");
    if (payout.status !== "pending") throw new HttpError(409, `Payout is already ${payout.status}`);
    if (status === "paid" && !reference) {
      throw new HttpError(422, "A transfer reference is required to mark a payout paid");
    }

    const updated = await db.$transaction(async (tx) => {
      const row = await tx.referralPayout.update({
        where: { id },
        data: { status, reference, note, paidAt: status === "paid" ? new Date() : null },
      });
      // Rejecting releases the commissions this request had claimed, so the
      // balance shows as owed again and can be re-requested. Marking it paid
      // leaves them attached — that link is what "already paid" means.
      if (status === "rejected") {
        await tx.referralCommission.updateMany({
          where: { payoutId: id },
          data: { payoutId: null },
        });
      }
      return row;
    });

    await db.auditLog.create({
      data: {
        actorId: admin.id,
        action: `referral_payout_${status}`,
        target: id,
        meta: { amount: payout.amount, currency: payout.currency, method: payout.method, reference, note },
      },
    });

    if (status === "paid") {
      await mail.payoutSent(payout.user.email, {
        name: payout.user.name,
        amount: Number(payout.amount),
        currency: payout.currency,
        method: payout.method,
        reference: reference!,
      });
    }

    return ok({ id: updated.id, status: updated.status });
  } catch (e) {
    return fail(e);
  }
}

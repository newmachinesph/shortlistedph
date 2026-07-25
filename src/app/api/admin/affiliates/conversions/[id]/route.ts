import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, parseBody } from "@/lib/api";
import { HttpError, requireAdmin } from "@/lib/session";

const Body = z.object({
  status: z.literal("void"),
  note: z.string().max(500).optional(),
});

/**
 * Kills a conversion the operator has decided is a self-referral.
 *
 * A voided conversion stops counting towards earnings, stops accruing new
 * commissions (recordCommission refuses void conversions), and its unpaid
 * commissions are deleted — but the conversion row itself stays so the
 * decision is auditable. Commissions inside a live or settled payout block
 * the void: settle or reject that payout first, otherwise the void would
 * silently change what the payout covers.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const { note } = await parseBody(req, Body);

    const conversion = await db.referralConversion.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        referralId: true,
        commissions: { select: { id: true, amount: true, currency: true, payoutId: true } },
      },
    });
    if (!conversion) throw new HttpError(404, "Conversion not found");
    if (conversion.status === "void") throw new HttpError(409, "Conversion is already void");
    if (conversion.commissions.some((c) => c.payoutId !== null)) {
      throw new HttpError(409, "Settle or reject the payout covering this conversion first");
    }

    const reversed = conversion.commissions.reduce((sum, c) => sum + Number(c.amount), 0);

    await db.$transaction([
      db.referralConversion.update({
        where: { id },
        data: { status: "void", rewardAmount: null, qualifiedAt: null },
      }),
      db.referralCommission.deleteMany({
        // payoutId null re-checked in the delete itself: a payout request
        // racing this void must not have its rows vanish underneath it.
        where: { conversionId: id, payoutId: null },
      }),
    ]);

    await db.auditLog.create({
      data: {
        actorId: admin.id,
        action: "referral_conversion_void",
        target: id,
        meta: {
          referralId: conversion.referralId,
          previousStatus: conversion.status,
          reversedAmount: reversed,
          reversedCommissions: conversion.commissions.length,
          note,
        },
      },
    });

    return ok({ id, status: "void" });
  } catch (e) {
    return fail(e);
  }
}

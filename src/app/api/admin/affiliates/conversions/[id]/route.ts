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
 * `void` was always in the status vocabulary with nothing to set it — the risk
 * chips on the affiliates page pointed at a problem and offered no lever. A
 * voided conversion stops counting towards earnings and towards anything
 * payable, but the row stays so the decision is auditable.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const { note } = await parseBody(req, Body);

    const conversion = await db.referralConversion.findUnique({
      where: { id },
      select: { id: true, status: true, payoutId: true, referralId: true, rewardAmount: true },
    });
    if (!conversion) throw new HttpError(404, "Conversion not found");
    if (conversion.status === "void") throw new HttpError(409, "Conversion is already void");
    // A conversion attached to a payout has either been paid or is inside a
    // live request. Voiding it there would silently change what that payout
    // covers, so settle the payout first.
    if (conversion.payoutId) {
      throw new HttpError(409, "Settle or reject the payout covering this conversion first");
    }

    await db.referralConversion.update({
      where: { id },
      data: { status: "void", rewardAmount: null, qualifiedAt: null },
    });

    await db.auditLog.create({
      data: {
        actorId: admin.id,
        action: "referral_conversion_void",
        target: id,
        meta: {
          referralId: conversion.referralId,
          previousStatus: conversion.status,
          reversedAmount: conversion.rewardAmount,
          note,
        },
      },
    });

    return ok({ id, status: "void" });
  } catch (e) {
    return fail(e);
  }
}

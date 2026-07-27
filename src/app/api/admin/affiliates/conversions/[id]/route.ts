import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, parseBody } from "@/lib/api";
import { HttpError, requireAdmin } from "@/lib/session";
import { EARNED, REFUNDED_REASON, VOIDED_REASON } from "@/lib/referral";

const Body = z.object({
  status: z.enum(["void", "active"]),
  note: z.string().max(500).optional(),
});

type Conversion = {
  id: string;
  status: string;
  referralId: string;
  qualifiedAt: Date | null;
  commissions: {
    amount: unknown;
    paymentId: string;
    payoutId: string | null;
    voidedAt: Date | null;
    voidedReason: string | null;
  }[];
};

/**
 * Kills — or revives — a conversion the operator has judged on.
 *
 * A voided conversion stops counting towards earnings, stops accruing new
 * commissions (recordCommission refuses void conversions), and its unpaid
 * commissions are marked voided rather than deleted: the surviving rows are
 * what make the decision both auditable and reversible. Commissions inside a
 * live or settled payout block the void — settle or reject that payout first,
 * otherwise the void would silently change what the payout covers.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const { status, note } = await parseBody(req, Body);

    const conversion = await db.referralConversion.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        referralId: true,
        qualifiedAt: true,
        commissions: {
          select: {
            amount: true,
            paymentId: true,
            payoutId: true,
            voidedAt: true,
            voidedReason: true,
          },
        },
      },
    });
    if (!conversion) throw new HttpError(404, "Conversion not found");

    return status === "void"
      ? await voidIt(conversion, admin.id, note)
      : await restore(conversion, admin.id, note);
  } catch (e) {
    return fail(e);
  }
}

function log(actorId: string, action: string, target: string, meta: object) {
  return db.auditLog.create({ data: { actorId, action, target, meta } });
}

async function voidIt(conversion: Conversion, actorId: string, note?: string) {
  if (conversion.status === "void") throw new HttpError(409, "Conversion is already void");
  if (conversion.commissions.some((c) => c.payoutId !== null)) {
    throw new HttpError(409, "Settle or reject the payout covering this conversion first");
  }

  const live = conversion.commissions.filter((c) => c.voidedAt === null);

  await db.$transaction([
    // qualifiedAt is kept: the status says void, and the date it first bought
    // is history a restore should not have to invent.
    db.referralConversion.update({ where: { id: conversion.id }, data: { status: "void" } }),
    db.referralCommission.updateMany({
      // payoutId null re-checked in the write itself: a payout request racing
      // this void must not have its rows voided underneath it.
      where: { conversionId: conversion.id, payoutId: null, ...EARNED },
      data: { voidedAt: new Date(), voidedReason: VOIDED_REASON },
    }),
  ]);

  await log(actorId, "referral_conversion_void", conversion.id, {
    referralId: conversion.referralId,
    previousStatus: conversion.status,
    reversedAmount: live.reduce((sum, c) => sum + Number(c.amount), 0),
    reversedCommissions: live.length,
    note,
  });

  return ok({ id: conversion.id, status: "void" });
}

/**
 * Reverses a void. ReferralConversion.userId is unique, so without this a
 * mistaken void barred that company from ever earning again — there is no
 * second conversion to create for them. Only commissions this action voided
 * come back: one voided because its payment was refunded stays dead, because
 * that money genuinely does not exist.
 */
async function restore(conversion: Conversion, actorId: string, note?: string) {
  if (conversion.status !== "void") throw new HttpError(409, "Conversion is not void");

  const candidates = conversion.commissions.filter((c) => c.voidedReason === VOIDED_REASON);
  // Reason alone is not enough to trust. A refund landing on an ALREADY-void
  // conversion has no live row to stamp, so its rows can still read as
  // admin-voided; reviving one pays out a purchase that was handed back. The
  // payment's own status is the fact, so it decides.
  const refunded = new Set(
    (
      await db.payment.findMany({
        where: { providerRef: { in: candidates.map((c) => c.paymentId) }, status: "refunded" },
        select: { providerRef: true },
      })
    ).map((p) => p.providerRef),
  );
  const revivable = candidates.filter((c) => !refunded.has(c.paymentId));
  const revived = revivable.length;
  const live = conversion.commissions.filter((c) => c.voidedAt === null).length;
  // "Qualified" means this referral produced a paying company, so it only comes
  // back if money comes back with it. With nothing to restore the conversion
  // returns to the plain signup it was, free to qualify on the next purchase.
  const earning = revived + live > 0;

  await db.$transaction([
    db.referralConversion.update({
      where: { id: conversion.id },
      data: {
        status: earning ? "qualified" : "signed_up",
        qualifiedAt: conversion.qualifiedAt ?? (earning ? new Date() : null),
      },
    }),
    db.referralCommission.updateMany({
      where: {
        conversionId: conversion.id,
        voidedReason: VOIDED_REASON,
        paymentId: { in: revivable.map((c) => c.paymentId) },
      },
      data: { voidedAt: null, voidedReason: null },
    }),
  ]);

  await log(actorId, "referral_conversion_restore", conversion.id, {
    referralId: conversion.referralId,
    restoredCommissions: revived,
    // Refund-voided rows stay dead — recorded here so nobody has to work out
    // later why the balance came back smaller than it went away.
    keptVoided:
      conversion.commissions.filter((c) => c.voidedReason === REFUNDED_REASON).length +
      refunded.size,
    note,
  });

  return ok({ id: conversion.id, status: earning ? "qualified" : "signed_up" });
}

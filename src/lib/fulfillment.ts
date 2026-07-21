import "server-only";
import { db } from "./db";
import { mail } from "./email";
import { notify } from "./notify";
import { PRODUCTS, type ProductId } from "./payments";
import { qualifyConversion } from "./referral";

/**
 * Every path that grants something paid-for goes through here.
 *
 * Both providers retry deliveries, and PayPal can arrive twice (capture
 * response AND webhook) for the same money. Payment.providerRef is unique, so
 * the second attempt collides and becomes a no-op instead of double-granting.
 */

export type FulfillResult = { granted: boolean; alreadyProcessed: boolean };

export async function fulfillPurchase(input: {
  userId: string;
  provider: "paypal" | "paymongo";
  providerRef: string;
  productId: ProductId;
  amount: number;
  currency: string;
}): Promise<FulfillResult> {
  const product = PRODUCTS[input.productId];

  const existing = await db.payment.findUnique({ where: { providerRef: input.providerRef } });
  if (existing?.status === "paid") return { granted: false, alreadyProcessed: true };

  try {
    await db.$transaction(async (tx) => {
      await tx.payment.upsert({
        where: { providerRef: input.providerRef },
        create: {
          userId: input.userId,
          provider: input.provider,
          providerRef: input.providerRef,
          amount: input.amount,
          currency: input.currency,
          purpose: input.productId,
          status: "paid",
        },
        update: { status: "paid" },
      });

      if (product.kind === "credits" && product.credits > 0) {
        const employer = await tx.employerAccount.findUnique({ where: { userId: input.userId } });
        if (!employer) throw new Error(`No employer account for user ${input.userId}`);

        await tx.employerAccount.update({
          where: { id: employer.id },
          data: { credits: { increment: product.credits } },
        });
        await tx.entitlement.createMany({
          data: Array.from({ length: product.credits }, () => ({
            employerId: employer.id,
            kind: "credit",
            source: input.providerRef,
          })),
        });
      }

      if (product.kind === "verification") {
        // Payment only unlocks the verification attempt. The badge itself is
        // set by the Didit webhook once identity actually checks out — paying
        // must never be enough to look verified.
        await tx.identityBinding.upsert({
          where: { userId: input.userId },
          create: { userId: input.userId },
          update: {},
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: input.userId,
          action: `payment.${input.productId}`,
          target: input.providerRef,
          meta: { provider: input.provider, amount: input.amount, currency: input.currency },
        },
      });
    });

    // Everything below runs AFTER the money is committed and is deliberately
    // outside the transaction: a bounced receipt or a referral bookkeeping
    // failure must never roll back a payment that already cleared.
    await afterFulfillment(input);

    return { granted: true, alreadyProcessed: false };
  } catch (e) {
    // Unique violation = a concurrent delivery won the race. Not an error.
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return { granted: false, alreadyProcessed: true };
    }
    throw e;
  }
}

/** Post-commit side effects. Swallows its own failures on purpose. */
async function afterFulfillment(input: {
  userId: string;
  providerRef: string;
  productId: ProductId;
  amount: number;
  currency: string;
}) {
  try {
    const user = await db.user.findUnique({
      where: { id: input.userId },
      select: { email: true, name: true },
    });
    if (!user) return;

    await notify({
      userId: input.userId,
      type: "payment_received",
      payload: {
        amount: input.amount,
        currency: input.currency,
        description: PRODUCTS[input.productId].label,
        reference: input.providerRef,
      },
    });

    await mail.paymentReceipt(user.email, {
      name: user.name,
      description: PRODUCTS[input.productId].label,
      amount: input.amount,
      currency: input.currency,
      reference: input.providerRef,
      date: new Date().toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    });

    // Only an employer's first credit purchase turns a signup into a payable
    // referral. productId is passed so referral.ts can enforce that: the
    // talent verification fee is billed at cost and we keep none of it, so
    // commissioning it would pay out of money that was never ours.
    // Flat bounty, so the payment's amount and currency are irrelevant here —
    // only which product it was and who bought it.
    await qualifyConversion(input.userId, {
      paymentId: input.providerRef,
      productId: input.productId,
    });
  } catch (e) {
    console.error("[fulfillment] post-commit side effects failed", e);
  }
}

/**
 * Interview payment. Separate from fulfillPurchase because the amount is
 * dynamic (interviewer rate + platform fee, locked on the interview row at
 * request time) rather than a fixed catalog product.
 *
 * The candidate has already consented by this point — payment only happens in
 * the "consented" state — so paying confirms an interview both sides agreed
 * to, and no refund path is needed for a decline that never charged.
 */
export async function fulfillInterview(input: {
  employerUserId: string;
  employerId: string;
  interviewId: string;
  providerRef: string;
  amount: number;
  currency: string;
}): Promise<FulfillResult> {
  const existing = await db.payment.findUnique({ where: { providerRef: input.providerRef } });
  if (existing?.status === "paid") return { granted: false, alreadyProcessed: true };

  const interview = await db.interview.findUnique({
    where: { id: input.interviewId },
    select: { id: true, employerId: true, status: true, priceUsd: true },
  });
  if (!interview || interview.employerId !== input.employerId) {
    console.error("[interview] payment for missing/foreign interview", {
      interviewId: input.interviewId,
      captureId: input.providerRef,
    });
    return { granted: false, alreadyProcessed: false };
  }
  // Trust the price we locked, not the amount echoed back. Underpayment is
  // logged but still recorded — chasing a few cents is not worth blocking a
  // confirmed interview; overpayment is the buyer's loss, not ours to keep.
  if (input.amount + 0.01 < interview.priceUsd) {
    console.error("[interview] captured amount below locked price", {
      interviewId: interview.id,
      captured: input.amount,
      locked: interview.priceUsd,
    });
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.payment.upsert({
        where: { providerRef: input.providerRef },
        create: {
          userId: input.employerUserId,
          provider: "paypal",
          providerRef: input.providerRef,
          amount: input.amount,
          currency: input.currency,
          purpose: "interview",
          status: "paid",
        },
        update: { status: "paid" },
      });
      // Status guard so a webhook arriving after the interview has already
      // advanced cannot drag it back to "paid".
      await tx.interview.updateMany({
        where: { id: interview.id, status: "consented" },
        data: { status: "paid", paymentRef: input.providerRef },
      });
      await tx.auditLog.create({
        data: {
          actorId: input.employerUserId,
          action: "interview.paid",
          target: interview.id,
          meta: { amount: input.amount, currency: input.currency, provider: "paypal" },
        },
      });
    });

    await afterInterviewPaid(interview.id, input.employerUserId);
    return { granted: true, alreadyProcessed: false };
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return { granted: false, alreadyProcessed: true };
    }
    throw e;
  }
}

/** Post-commit, best-effort: tell the interviewer they have a confirmed
 * assignment and the candidate the interview is booked. */
async function afterInterviewPaid(interviewId: string, employerUserId: string) {
  try {
    const iv = await db.interview.findUnique({
      where: { id: interviewId },
      select: {
        talentUserId: true,
        priceUsd: true,
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

    const employer = await db.user.findUnique({
      where: { id: employerUserId },
      select: { email: true, name: true },
    });
    if (employer) {
      await mail.paymentReceipt(employer.email, {
        name: employer.name,
        description: "Interview booking",
        amount: iv.priceUsd,
        currency: "USD",
        reference: interviewId,
        date: new Date().toLocaleDateString("en-PH", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
      });
    }
  } catch (e) {
    console.error("[interview] post-payment side effects failed", e);
  }
}

export async function markPaymentFailed(providerRef: string) {
  await db.payment.updateMany({ where: { providerRef }, data: { status: "failed" } });
}

export async function markPaymentRefunded(providerRef: string) {
  await db.payment.updateMany({ where: { providerRef }, data: { status: "refunded" } });
}

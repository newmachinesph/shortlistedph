import "server-only";
import { db } from "./db";
import { mail } from "./email";
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

    // A referred user's first real payment is what turns a signup into a
    // payable referral.
    await qualifyConversion(input.userId, {
      paymentId: input.providerRef,
      amount: input.amount,
      currency: input.currency,
    });
  } catch (e) {
    console.error("[fulfillment] post-commit side effects failed", e);
  }
}

export async function markPaymentFailed(providerRef: string) {
  await db.payment.updateMany({ where: { providerRef }, data: { status: "failed" } });
}

export async function markPaymentRefunded(providerRef: string) {
  await db.payment.updateMany({ where: { providerRef }, data: { status: "refunded" } });
}

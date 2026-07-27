import "server-only";
import { Prisma } from "@prisma/client";
import { isUniqueViolation } from "./api";
import { db } from "./db";
import { mail } from "./email";
import { notify } from "./notify";
import { PRODUCTS, toMinorUnits, type ProductId } from "./payments";
import { REFUNDED_REASON, VOIDED_REASON, recordCommission } from "./referral";

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
  // A refund can land BEFORE the capture it belongs to: PayPal orders nothing
  // and retries a capture for days. Granting here would hand out credits and a
  // $9 commission for money that is already back with the buyer, so the
  // refunded row — written by markPaymentRefunded whether or not the capture
  // ever arrived — is a hard stop, not a duplicate.
  if (existing?.status === "refunded") {
    console.error(
      `[fulfillment] capture ${input.providerRef} arrived AFTER its refund — nothing granted`,
    );
    return { granted: false, alreadyProcessed: true };
  }

  const row = {
    userId: input.userId,
    provider: input.provider,
    providerRef: input.providerRef,
    amount: input.amount,
    currency: input.currency,
    purpose: input.productId,
  };

  // The catalog price is the only price. Both webhooks decided WHAT was bought
  // from a reference id and then granted it against whatever amount came with
  // the delivery — an order edited down before approval, or a PayMongo payload
  // with no amount at all (it used to default to exactly the catalog figure),
  // bought the same goods for less. Fails closed: no amount is a mismatch, not
  // a default. Recorded rather than dropped, because the money did arrive and
  // somebody has to decide what to do with it.
  if (
    input.currency !== product.currency ||
    toMinorUnits(input.amount) !== toMinorUnits(product.amount)
  ) {
    console.error(
      `[fulfillment] ${input.provider} ${input.providerRef}: paid ${input.currency} ${input.amount} for "${input.productId}" listed at ${product.currency} ${product.amount} — NOT granted`,
    );
    // Recorded as an AuditLog, NOT as a Payment row. Writing one here did two
    // things wrong at once: "amount_mismatch" is not in payment_status_check,
    // so the write threw 23514 and the provider retried the webhook forever;
    // and had it succeeded it would have claimed this providerRef, so the SAME
    // capture redelivered with a correct amount would collide on the unique
    // index and be swallowed as "already processed" — money taken, nothing
    // granted, permanently. A delivery we refuse must leave the id free for
    // the delivery we would accept.
    await db.auditLog.create({
      data: {
        actorId: input.userId,
        action: "payment.amount_mismatch",
        target: input.providerRef,
        meta: {
          provider: input.provider,
          productId: input.productId,
          paid: `${input.currency} ${input.amount}`,
          listed: `${product.currency} ${product.amount}`,
        },
      },
    });
    return { granted: false, alreadyProcessed: false };
  }

  try {
    await db.$transaction(async (tx) => {
      // MUST be create, not upsert: upsert never throws on conflict, which
      // would let a concurrent duplicate delivery fall through to the grant
      // block below and double-credit. The unique violation from create is
      // what makes the loser of the race abort before granting anything.
      await tx.payment.create({ data: { ...row, status: "paid" } });

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

      if (product.kind === "interview_credits" && product.interviewCredits > 0) {
        const employer = await tx.employerAccount.findUnique({ where: { userId: input.userId } });
        if (!employer) throw new Error(`No employer account for user ${input.userId}`);

        await tx.employerAccount.update({
          where: { id: employer.id },
          data: { interviewCredits: { increment: product.interviewCredits } },
        });
        await tx.entitlement.createMany({
          data: Array.from({ length: product.interviewCredits }, () => ({
            employerId: employer.id,
            kind: "interview_credit",
            source: input.providerRef,
          })),
        });
      }

      if (product.kind === "verification") {
        // Payment only unlocks the verification ATTEMPT and queues it for
        // review. Nothing here touches TalentProfile.verifiedTier — only
        // approveVerification (lib/verification.ts) does, because paying must
        // never be enough to look verified.
        await tx.identityBinding.upsert({
          where: { userId: input.userId },
          create: { userId: input.userId, status: "pending" },
          // A re-paid attempt after a rejection re-opens the review.
          update: { status: "pending", note: null, reviewedAt: null },
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
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
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
  // MONEY FIRST, COSMETICS SECOND — and never in the same try.
  //
  // These all used to share one catch, with the receipt email ahead of the
  // commission. A bounced receipt therefore skipped the affiliate's earnings
  // permanently: the payment is idempotent, so fulfilment never runs again and
  // nothing retries. Someone else's money must not depend on our mail server.
  //
  // Every shortlist-credit purchase by a referred employer earns the flat
  // recurring commission — providerRef's uniqueness makes replays safe.
  // productId is passed so referral-reward.ts can enforce the gate: interview
  // credits and the at-cost verification fee never earn.
  try {
    await recordCommission(input.userId, {
      paymentId: input.providerRef,
      productId: input.productId,
    });
  } catch (e) {
    console.error("[fulfillment] COMMISSION FAILED — affiliate underpaid", input.providerRef, e);
  }

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
  } catch (e) {
    console.error("[fulfillment] receipt/notification failed", e);
  }
}

// Interviews are no longer paid inline per booking — an employer spends one
// interview credit to confirm instead (see lib/interviews.ts confirmInterview
// and /api/interviews/[id]/confirm). Interview credits are bought ahead through
// fulfillPurchase like shortlist credits, so there is no dynamic-price interview
// fulfillment path here anymore.

export async function markPaymentFailed(providerRef: string) {
  await db.payment.updateMany({ where: { providerRef }, data: { status: "failed" } });
}

/**
 * A refund has to undo what the payment granted, not just relabel the row.
 *
 * Before this, refunding left the credits, the entitlement ledger and the
 * affiliate's $9 commission fully intact — the money went back and the goods
 * stayed. Now:
 *   - unspent entitlements bought by this payment are revoked and the matching
 *     balance decremented (never below zero);
 *   - already-spent ones are left alone and reported, because a slate that was
 *     unlocked cannot be un-seen — that is a human conversation, not a rollback;
 *   - the referral commission for this payment is voided, whether or not an
 *     admin void already got to it;
 *   - a verification whose review is still open is closed, so the buyer can pay
 *     again instead of being locked out by their own refunded attempt.
 *
 * Idempotent: a replayed refund webhook finds nothing left unrevoked and is a
 * no-op. Returns what actually moved so the caller can log/alert.
 */
export async function markPaymentRefunded(
  providerRef: string,
  /**
   * What the provider says was refunded, used only when the capture has not
   * landed yet. Payment.userId is not nullable, so a pre-capture refund can be
   * recorded at all only when the caller could resolve the payer from the
   * event itself.
   */
  refunded?: {
    userId: string;
    provider: "paypal" | "paymongo";
    productId: ProductId;
    amount: number;
    currency: string;
  },
): Promise<{
  revoked: number;
  alreadySpent: number;
  commissionVoided: boolean;
}> {
  const payment = await db.payment.findUnique({ where: { providerRef } });
  if (!payment) return recordPreCaptureRefund(providerRef, refunded);

  const result = await db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { providerRef },
      data: { status: "refunded", refundedAt: new Date() },
    });

    const granted = await tx.entitlement.findMany({
      where: { source: providerRef, revokedAt: null },
      select: { id: true, kind: true, spentOnSlateId: true, spentOnInterviewId: true },
    });
    const spendable = granted.filter((e) => !e.spentOnSlateId && !e.spentOnInterviewId);
    const alreadySpent = granted.length - spendable.length;

    if (spendable.length > 0) {
      await tx.entitlement.updateMany({
        where: { id: { in: spendable.map((e) => e.id) } },
        data: { revokedAt: new Date(), revokedReason: `refund:${providerRef}` },
      });

      const employer = await tx.employerAccount.findFirst({
        where: { userId: payment.userId },
        select: { id: true },
      });
      if (!employer) {
        // Entitlements are revoked but no balance moved. Loud, because the
        // silent version of this reported a clean clawback that never happened.
        console.error(
          `[fulfillment] refund ${providerRef}: revoked ${spendable.length} entitlement(s) but user ${payment.userId} has no employer account — balance NOT adjusted`,
        );
      } else {
        const credits = spendable.filter((e) => e.kind === "credit").length;
        const interview = spendable.filter((e) => e.kind === "interview_credit").length;
        // Atomic decrement, NOT read-then-write. Reading the balance and
        // writing back `read - n` loses any concurrent unlock or interview
        // confirm that commits in between: the refund would restore a credit
        // the employer had already spent. Every other writer in the codebase
        // uses increment/decrement; this one has to as well.
        //
        // The clamp that used to guard against a negative balance moves into
        // the WHERE: decrement only what is actually there.
        if (credits > 0) {
          await tx.employerAccount.updateMany({
            where: { id: employer.id, credits: { gte: credits } },
            data: { credits: { decrement: credits } },
          });
        }
        if (interview > 0) {
          await tx.employerAccount.updateMany({
            where: { id: employer.id, interviewCredits: { gte: interview } },
            data: { interviewCredits: { decrement: interview } },
          });
        }
      }
    }

    if (payment.purpose === "verification") {
      // Fulfilment opened a review; without closing it hasOpenVerification
      // keeps refusing a new attempt forever — paid, refunded, and locked out
      // of ever paying again. Only a still-pending attempt is touched: an
      // approved one is a badge already granted, which is a human conversation
      // rather than a status flip.
      await tx.identityBinding.updateMany({
        where: { userId: payment.userId, status: "pending" },
        data: {
          status: "rejected",
          reviewedAt: new Date(),
          note: "Payment refunded before review — pay again to reopen verification.",
        },
      });
    }

    // The affiliate is paid for a purchase that no longer exists.
    // The exact string matters: the admin un-void path refuses to resurrect
    // commissions killed by a refund, and it keys off this reason.
    const voided = await tx.referralCommission.updateMany({
      where: { paymentId: providerRef, voidedAt: null },
      data: { voidedAt: new Date(), voidedReason: REFUNDED_REASON },
    });

    // An admin void that landed FIRST matched every live row, so the write
    // above matches none and the refund leaves no trace at all — the un-void
    // then pays out a purchase that was handed back. Overwriting the reason is
    // what makes the refund the last word regardless of arrival order.
    const claimed = await tx.referralCommission.updateMany({
      where: { paymentId: providerRef, voidedReason: VOIDED_REASON },
      data: { voidedReason: REFUNDED_REASON },
    });

    const commissionVoided = voided.count + claimed.count > 0;
    await tx.auditLog.create({
      data: {
        actorId: null,
        action: "payment.refunded",
        target: providerRef,
        meta: { revoked: spendable.length, alreadySpent, commissionVoided },
      },
    });

    return { revoked: spendable.length, alreadySpent, commissionVoided };
  });

  if (result.alreadySpent > 0) {
    console.warn(
      `[fulfillment] refund ${providerRef}: ${result.alreadySpent} credit(s) were already spent and could not be reclaimed`,
    );
  }

  // Best-effort, post-commit: never let a notification failure undo a refund.
  try {
    await notify({
      userId: payment.userId,
      type: "payment_refunded",
      payload: { amount: String(payment.amount), currency: payment.currency, reference: providerRef },
    });
  } catch (e) {
    console.error("[fulfillment] refund notification failed", e);
  }

  return result;
}

/**
 * A refund whose capture has not arrived yet.
 *
 * This used to `return` on the missing Payment row without a word, so the
 * capture — which PayPal retries for days, in no particular order relative to
 * anything else — landed afterwards and granted credits plus a $9 commission
 * for money already handed back. The refunded row IS the record: fulfilment
 * refuses to grant against it, and the normal capture-then-refund path never
 * reaches here at all.
 */
async function recordPreCaptureRefund(
  providerRef: string,
  refunded?: {
    userId: string;
    provider: "paypal" | "paymongo";
    productId: ProductId;
    amount: number;
    currency: string;
  },
): Promise<{ revoked: number; alreadySpent: number; commissionVoided: boolean }> {
  const nothing = { revoked: 0, alreadySpent: 0, commissionVoided: false };
  if (!refunded) {
    console.error(
      `[fulfillment] refund ${providerRef}: no payment row and no payer resolvable from the event — a later capture WILL grant against it`,
    );
    return nothing;
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          userId: refunded.userId,
          provider: refunded.provider,
          providerRef,
          amount: refunded.amount,
          currency: refunded.currency,
          purpose: refunded.productId,
          status: "refunded",
          refundedAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: null,
          action: "payment.refunded",
          target: providerRef,
          meta: { preCapture: true, amount: refunded.amount, currency: refunded.currency },
        },
      });
    });
  } catch (e) {
    // The capture won the race between the read and this write, so it granted
    // and the refund has real work to do after all. Its row is there now, which
    // makes the second pass the ordinary path.
    if (isUniqueViolation(e)) return markPaymentRefunded(providerRef);
    throw e;
  }

  return nothing;
}

// wasInterviewCreditRefunded lives in lib/interviews.ts, not here: this module
// imports payments.ts, which imports interviews.ts for the interview price, so
// interviews.ts importing this one closes a cycle that breaks the build.

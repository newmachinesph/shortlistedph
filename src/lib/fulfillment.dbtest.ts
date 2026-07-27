/**
 * Money paths, against a real Postgres.
 *
 *   npm run test:money        (needs DATABASE_URL — dev only, never prod)
 *
 * These are integration tests on purpose. Every bug this file exists to catch
 * was a bug about what the DATABASE ended up holding — a balance that did not
 * move, entitlements revoked that were still paid for, a commission voided
 * twice — and none of them are visible to a test that mocks the client.
 *
 * Runs outside Next, which needs three things (see scripts/node-resolve.mjs):
 * the react-server condition so `import "server-only"` is a no-op, a resolver
 * for `@/` and extensionless imports, and a stub for the one .tsx module lib/
 * pulls in.
 *
 * Every test owns its own employer and cleans up after itself, so the suite can
 * run repeatedly against a database with real rows in it.
 */
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { config } from "dotenv";

config({ path: ".env.local", override: true });

const { db } = await import("./db.ts");
const { fulfillPurchase, markPaymentRefunded } = await import("./fulfillment.ts");
const { PRODUCTS } = await import("./payments.ts");

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing from .env.local");

let seq = 0;
const created: string[] = [];

/** A fresh employer with a user, torn down in `after`. */
async function newEmployer() {
  const id = `money-test-${Date.now()}-${seq++}`;
  const user = await db.user.create({
    data: {
      id,
      name: "Money Test",
      email: `${id}@example.com`,
      emailVerified: true,
      role: "employer",
    },
  });
  const employer = await db.employerAccount.create({
    data: { userId: user.id, companyName: "Money Test Co" },
  });
  created.push(user.id);
  return { userId: user.id, employerId: employer.id };
}

/**
 * A slate for a credit to have been spent on. Entitlement.spentOnSlateId is a
 * real foreign key — the whole point of it, so a spent credit always names the
 * thing it bought — which means the already-spent branch cannot be tested by
 * writing an id that points at nothing.
 */
async function newSlate(employerId: string) {
  const jd = await db.jobDescription.create({
    data: { employerId, title: "Money test brief", status: "slate_ready" },
  });
  const slate = await db.slate.create({ data: { jdId: jd.id, status: "unlocked" } });
  return slate.id;
}

/**
 * The affiliate side of a purchase. Built directly rather than through
 * recordCommission: what is under test here is what a REFUND does to a
 * commission, so the commission has to exist regardless of whether the reward
 * rules would have granted one.
 */
async function newCommission(buyerId: string, paymentId: string) {
  const affiliateId = `money-test-aff-${Date.now()}-${seq++}`;
  const affiliate = await db.user.create({
    data: { id: affiliateId, name: "Affiliate", email: `${affiliateId}@example.com` },
  });
  const referral = await db.referral.create({
    data: { userId: affiliate.id, code: affiliateId },
  });
  const conversion = await db.referralConversion.create({
    data: { referralId: referral.id, userId: buyerId, status: "qualified" },
  });
  await db.referralCommission.create({
    data: {
      referralId: referral.id,
      conversionId: conversion.id,
      paymentId,
      amount: 9,
      currency: "USD",
    },
  });
  created.push(affiliate.id);
}

async function balances(employerId: string) {
  const e = await db.employerAccount.findUniqueOrThrow({
    where: { id: employerId },
    select: { credits: true, interviewCredits: true },
  });
  return e;
}

async function entitlementState(providerRef: string) {
  const rows = await db.entitlement.findMany({ where: { source: providerRef } });
  return {
    total: rows.length,
    live: rows.filter((r) => !r.revokedAt).length,
    revoked: rows.filter((r) => r.revokedAt).length,
  };
}

/** Buys `productId` at its catalog price, which is the only price fulfilment accepts. */
async function buy(userId: string, productId: keyof typeof PRODUCTS, ref: string) {
  const product = PRODUCTS[productId];
  const result = await fulfillPurchase({
    userId,
    provider: "paypal",
    providerRef: ref,
    productId,
    amount: Number(product.amount),
    currency: product.currency,
  });
  assert.equal(result.granted, true, "fulfilment should have granted");
  return ref;
}

after(async () => {
  // Payment, Entitlement, Slate and ReferralCommission are all Restrict-guarded
  // — that is what they are FOR — so teardown names each one in dependency
  // order instead of leaning on a cascade that deliberately does not exist.
  for (const userId of created) {
    await db.referralCommission.deleteMany({
      where: { OR: [{ conversion: { userId } }, { referral: { userId } }] },
    });
    await db.referralConversion.deleteMany({ where: { userId } });
    await db.referral.deleteMany({ where: { userId } });

    const employer = await db.employerAccount.findUnique({ where: { userId } });
    if (employer) {
      await db.entitlement.deleteMany({ where: { employerId: employer.id } });
      await db.slate.deleteMany({ where: { jd: { employerId: employer.id } } });
      await db.jobDescription.deleteMany({ where: { employerId: employer.id } });
    }
    await db.payment.deleteMany({ where: { userId } });
    await db.auditLog.deleteMany({ where: { actorId: userId } });
    await db.notification.deleteMany({ where: { userId } });
    await db.user.delete({ where: { id: userId } });
  }
  await db.$disconnect();
});

describe("fulfillPurchase", () => {
  it("grants credits, entitlements and a paid payment row", async () => {
    const { userId, employerId } = await newEmployer();
    const ref = await buy(userId, "three_pack", `test-cap-${userId}`);

    assert.equal((await balances(employerId)).credits, 3);
    assert.deepEqual(await entitlementState(ref), { total: 3, live: 3, revoked: 0 });
    const payment = await db.payment.findUniqueOrThrow({ where: { providerRef: ref } });
    assert.equal(payment.status, "paid");
  });

  it("is idempotent — a redelivered capture grants nothing twice", async () => {
    const { userId, employerId } = await newEmployer();
    const ref = await buy(userId, "three_pack", `test-dup-${userId}`);

    const second = await fulfillPurchase({
      userId,
      provider: "paypal",
      providerRef: ref,
      productId: "three_pack",
      amount: Number(PRODUCTS.three_pack.amount),
      currency: "USD",
    });

    assert.deepEqual(second, { granted: false, alreadyProcessed: true });
    assert.equal((await balances(employerId)).credits, 3);
  });

  it("refuses to grant when the amount does not match the catalog", async () => {
    const { userId, employerId } = await newEmployer();
    const ref = `test-underpaid-${userId}`;

    const result = await fulfillPurchase({
      userId,
      provider: "paypal",
      providerRef: ref,
      productId: "three_pack",
      amount: 1,
      currency: "USD",
    });

    assert.deepEqual(result, { granted: false, alreadyProcessed: false });
    assert.equal((await balances(employerId)).credits, 0);
    // The id must stay free, so the same capture redelivered at the right
    // amount can still be honoured.
    assert.equal(await db.payment.findUnique({ where: { providerRef: ref } }), null);
  });
});

describe("markPaymentRefunded — full", () => {
  it("revokes every unspent entitlement and decrements the balance", async () => {
    const { userId, employerId } = await newEmployer();
    const ref = await buy(userId, "three_pack", `test-full-${userId}`);

    const result = await markPaymentRefunded(ref);

    assert.equal(result.revoked, 3);
    assert.equal((await balances(employerId)).credits, 0);
    assert.deepEqual(await entitlementState(ref), { total: 3, live: 0, revoked: 3 });
    const payment = await db.payment.findUniqueOrThrow({ where: { providerRef: ref } });
    assert.equal(payment.status, "refunded");
    assert.notEqual(payment.refundedAt, null);
  });

  it("leaves an already-spent credit alone and reports it", async () => {
    const { userId, employerId } = await newEmployer();
    const ref = await buy(userId, "three_pack", `test-spent-${userId}`);

    const slateId = await newSlate(employerId);
    const spent = await db.entitlement.findFirstOrThrow({ where: { source: ref } });
    await db.entitlement.update({ where: { id: spent.id }, data: { spentOnSlateId: slateId } });

    const result = await markPaymentRefunded(ref);

    // An unlocked slate cannot be un-seen. Two credits come back; the spent one
    // is reported for a human rather than silently clawed back.
    assert.equal(result.revoked, 2);
    assert.equal(result.alreadySpent, 1);
    assert.equal((await balances(employerId)).credits, 1);
    assert.deepEqual(await entitlementState(ref), { total: 3, live: 1, revoked: 2 });
  });
});

describe("markPaymentRefunded — partial", () => {
  it("revokes only what the refunded amount actually covers", async () => {
    const { userId, employerId } = await newEmployer();
    // Five interview credits at $70 — a clean $14 each, so the arithmetic under
    // test is the proportion, not the rounding.
    const ref = await buy(userId, "interview_five", `test-partial-${userId}`);
    assert.equal((await balances(employerId)).interviewCredits, 5);

    const result = await markPaymentRefunded(ref, {
      refund: { id: `ref-one-${userId}`, amount: 14 },
    });

    assert.equal(result.revoked, 1, "one credit refunded should revoke one credit");
    assert.equal((await balances(employerId)).interviewCredits, 4);
    assert.deepEqual(await entitlementState(ref), { total: 5, live: 4, revoked: 1 });

    // A partial refund is not a cancelled purchase: the buyer still holds four
    // credits, so the row must not read as fully refunded.
    const payment = await db.payment.findUniqueOrThrow({ where: { providerRef: ref } });
    assert.equal(payment.status, "paid");
    assert.equal(payment.refundedAt, null);
    assert.equal(Number(payment.refundedAmount), 14);
  });

  it("accumulates across refunds and closes the purchase when they add up to all of it", async () => {
    const { userId, employerId } = await newEmployer();
    const ref = await buy(userId, "interview_five", `test-accum-${userId}`);

    await markPaymentRefunded(ref, { refund: { id: `a-${userId}`, amount: 28 } });
    assert.equal((await balances(employerId)).interviewCredits, 3);

    await markPaymentRefunded(ref, { refund: { id: `b-${userId}`, amount: 42 } });

    assert.equal((await balances(employerId)).interviewCredits, 0);
    assert.deepEqual(await entitlementState(ref), { total: 5, live: 0, revoked: 5 });
    const payment = await db.payment.findUniqueOrThrow({ where: { providerRef: ref } });
    assert.equal(payment.status, "refunded");
    assert.equal(Number(payment.refundedAmount), 70);
  });

  it("ignores a redelivered refund webhook", async () => {
    const { userId, employerId } = await newEmployer();
    const ref = await buy(userId, "interview_five", `test-replay-${userId}`);
    const refund = { id: `same-${userId}`, amount: 14 };

    await markPaymentRefunded(ref, { refund });
    const again = await markPaymentRefunded(ref, { refund });

    assert.equal(again.revoked, 0, "the same refund id must not claw back twice");
    assert.equal((await balances(employerId)).interviewCredits, 4);
  });

  it("does not void the affiliate's commission for a partial refund", async () => {
    const { userId, employerId } = await newEmployer();
    const ref = await buy(userId, "three_pack", `test-commission-${userId}`);
    await newCommission(userId, ref);

    // $119 for three, so one shortlist is $39.67 — deliberately not a round
    // number, because real partial refunds are not either.
    await markPaymentRefunded(ref, { refund: { id: `part-${userId}`, amount: 39.67 } });

    const commission = await db.referralCommission.findFirstOrThrow({
      where: { paymentId: ref },
    });
    assert.equal(commission.voidedAt, null, "the purchase still stands, so the commission does");
    assert.equal((await balances(employerId)).credits, 2);
  });

  it("voids the commission once the refund is complete", async () => {
    const { userId } = await newEmployer();
    const ref = await buy(userId, "three_pack", `test-commission-full-${userId}`);
    await newCommission(userId, ref);

    const result = await markPaymentRefunded(ref);

    assert.equal(result.commissionVoided, true);
    const commission = await db.referralCommission.findFirstOrThrow({
      where: { paymentId: ref },
    });
    assert.notEqual(commission.voidedAt, null);
  });
});

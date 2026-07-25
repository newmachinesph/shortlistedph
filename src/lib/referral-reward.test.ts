import test from "node:test";
import assert from "node:assert/strict";
import { REFERRAL_REWARD, commissionFor } from "./referral-reward.ts";

test("shortlist credit purchases earn the flat commission", () => {
  assert.deepEqual(commissionFor("credits"), {
    amount: REFERRAL_REWARD.amount,
    currency: "USD",
  });
});

test("interview credits and verification never earn", () => {
  assert.equal(commissionFor("interview_credits"), null);
  assert.equal(commissionFor("verification"), null);
});

test("the payout minimum is denominated in the currency commissions accrue in", () => {
  // A ₱500 minimum could never be compared to a USD balance without an FX rate.
  // Same currency, and one qualifying purchase clears it.
  assert.equal(REFERRAL_REWARD.minPayout, REFERRAL_REWARD.amount);
});

test("commission is flat — $9, not scaled by anything", () => {
  assert.equal(REFERRAL_REWARD.amount, 9.0);
  // commissionFor takes only the product kind: there is no amount/credits
  // parameter to multiply by, which is the point.
  assert.equal(commissionFor.length, 1);
});

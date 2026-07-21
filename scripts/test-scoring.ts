/**
 * DB-free self-check for the loosened skill matcher.
 *
 *   node --experimental-strip-types scripts/test-scoring.ts
 *
 * Guards the exact wording cases that were silently dropping qualified people:
 * plural/gerund differences ("Refunds" vs "Refund processing") and phrase
 * subsets ("Live chat" vs "Live chat support") must now count, while an
 * off-domain skill set must not.
 */
import assert from "node:assert/strict";
import { QUALIFY_SKILLS, scoreSkills } from "../src/lib/scoring.ts";

const s = (name: string, confirmed = false) => ({
  normalizedName: name.toLowerCase(),
  confirmed,
});

const support = [
  s("zendesk"),
  s("live chat support"),
  s("refund processing"),
  s("email support"),
];

// The support brief: exact tag + phrase subset + plural — all should register.
const onSupport = scoreSkills(["Zendesk", "Live chat", "Refunds"], support, 0.65, {
  headline: "Customer support specialist",
});
assert.ok(onSupport >= QUALIFY_SKILLS, `support skills ${onSupport} should clear ${QUALIFY_SKILLS}`);

// Old exact-only matching missed the plural; confirm "Refunds" now contributes
// by checking the score drops when that skill is removed.
const withoutRefunds = scoreSkills(["Zendesk", "Live chat", "Refunds"], support.slice(0, 2), 0.65, {
  headline: "Customer support specialist",
});
assert.ok(onSupport > withoutRefunds, "removing Refund processing must lower the score");

// Wrong domain: a bookkeeper against a support brief stays well below the gate.
const bookkeeper = [s("quickbooks"), s("bank reconciliation"), s("payroll")];
const offDomain = scoreSkills(["Zendesk", "Live chat", "Refunds"], bookkeeper, 0.2, {
  headline: "Bookkeeper",
});
assert.ok(offDomain < QUALIFY_SKILLS, `off-domain skills ${offDomain} should stay below ${QUALIFY_SKILLS}`);

// The stemmer must not match on short fragments ("art" in "smart").
const fragment = scoreSkills(["Art direction"], [s("smart contracts")], 0, {});
assert.ok(fragment === 0, `fragment match leaked: ${fragment}`);

console.log("scoring self-check passed");

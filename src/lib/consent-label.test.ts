/**
 * Consent-path leak guard.
 * Run with: node --experimental-strip-types src/lib/consent-label.test.ts
 *
 * Sibling of openings.test.ts, for the surface that test does not cover. The
 * board fails closed on JobDescription.title because it "can contain a client
 * name"; the consent email and the invitations page used to render that exact
 * field. candidateRoleLabel is now the only door, and these pin it shut.
 */
import assert from "node:assert/strict";
import { candidateRoleLabel } from "./openings-shape.ts";

let pass = 0;
const check = (label: string, fn: () => void) => {
  fn();
  pass++;
  console.log(`  ok  ${label}`);
};

// What a leak looks like: the employer wrote their own client's name into it.
const RAW_TITLE = "Shopify support agent for Acme Apparel Co.";

check("prefers the admin-sanitised public title", () => {
  assert.equal(
    candidateRoleLabel({ publicTitle: "Ecommerce customer support", roleFamily: "ecommerce_ops" }),
    "Ecommerce customer support",
  );
});

check("falls back to the controlled role-family label", () => {
  assert.equal(candidateRoleLabel({ publicTitle: null, roleFamily: "bookkeeping" }), "Bookkeeping & accounting");
});

check("a blank public title is treated as absent, not rendered", () => {
  assert.equal(candidateRoleLabel({ publicTitle: "   ", roleFamily: "engineering" }), "Engineering");
});

check("stays generic and non-identifying when nothing has been sanitised", () => {
  const label = candidateRoleLabel({ publicTitle: null, roleFamily: null });
  assert.equal(label, "Remote role");
});

check("never returns the raw employer title, whatever else is on the row", () => {
  // The row shape a caller might hand it — extra fields must be ignored, so a
  // future `select: { title: true }` cannot quietly become the label again.
  for (const roleFamily of ["ecommerce_ops", null]) {
    const label = candidateRoleLabel({ publicTitle: null, roleFamily, title: RAW_TITLE } as never);
    assert.notEqual(label, RAW_TITLE);
    assert.ok(!label.includes("Acme"), `candidate label leaked the employer: "${label}"`);
  }
});

console.log(`\n${pass} passed`);

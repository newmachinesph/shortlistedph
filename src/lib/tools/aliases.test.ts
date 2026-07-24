/**
 * Tool alias table.
 * Run with: node --experimental-strip-types src/lib/tools/aliases.test.ts
 *
 * Two invariants, and the second matters more than the first: known variants
 * must merge, and unrelated tools must NEVER merge. A wrong merge scores people
 * for skills they do not have, which is the gaming the platform exists to stop.
 */
import assert from "node:assert/strict";
import { KNOWN_TOOL_COUNT, canonicalizeTool } from "./aliases.ts";
import { matchRequirements, normalizeSkill } from "../scoring.ts";

let pass = 0;
const check = (label: string, fn: () => void) => {
  fn();
  pass++;
  console.log(`  ok  ${label}`);
};

const canon = (s: string) => canonicalizeTool(normalizeSkill(s));

// ── merges that must happen ────────────────────────────────────────────────

check("QBO and QuickBooks Online resolve to the same tool", () => {
  assert.equal(canon("QBO"), canon("QuickBooks Online"));
  assert.equal(canon("quickbooks"), canon("Quick Books"));
});

check("common dev aliases merge", () => {
  assert.equal(canon("ReactJS"), canon("React.js"));
  assert.equal(canon("Postgres"), canon("PostgreSQL"));
  assert.equal(canon("node"), canon("Node.js"));
});

check("support and ecommerce aliases merge", () => {
  assert.equal(canon("Zen Desk"), canon("Zendesk"));
  assert.equal(canon("helium10"), canon("Helium 10"));
  assert.equal(canon("Amazon Ads"), canon("Amazon PPC"));
});

// ── merges that must NOT happen (the load-bearing half) ────────────────────

check("distinct accounting tools stay distinct", () => {
  assert.notEqual(canon("QuickBooks"), canon("Xero"));
  assert.notEqual(canon("Xero"), canon("Sage"));
  assert.notEqual(canon("FreshBooks"), canon("Freshdesk")); // near-identical spelling, different products
});

check("distinct helpdesk tools stay distinct", () => {
  assert.notEqual(canon("Zendesk"), canon("Freshdesk"));
  assert.notEqual(canon("Gorgias"), canon("Intercom"));
});

check("distinct databases stay distinct", () => {
  assert.notEqual(canon("PostgreSQL"), canon("MySQL"));
  assert.notEqual(canon("MongoDB"), canon("PostgreSQL"));
});

check("an unknown tool is returned unchanged, never merged into a neighbour", () => {
  assert.equal(canon("Obscure Custom CRM 9000"), normalizeSkill("Obscure Custom CRM 9000"));
});

// ── non-tool requirements are untouched (behaviour preserved) ──────────────

check("multi-word non-tool requirements pass through unchanged", () => {
  for (const phrase of ["Bank reconciliation", "US dental practice experience", "Month-end close"]) {
    assert.equal(canon(phrase), normalizeSkill(phrase));
  }
});

// ── the whole point: canonicalization lifts an exact match ─────────────────

check("a QBO skill now scores an exact hit against a QuickBooks must-have", () => {
  const before = matchRequirements(["QuickBooks"], [{ normalizedName: normalizeSkill("Zoho"), confirmed: false }]);
  assert.equal(before[0].kind, "none", "sanity: an unrelated skill is not a match");

  const after = matchRequirements(["QuickBooks"], [{ normalizedName: normalizeSkill("QBO"), confirmed: false }]);
  assert.equal(after[0].kind, "claimed", "QBO must now exact-match a QuickBooks requirement");

  const confirmed = matchRequirements(["QuickBooks Online"], [{ normalizedName: normalizeSkill("quickbooks"), confirmed: true }]);
  assert.equal(confirmed[0].kind, "confirmed", "a confirmed alias earns the confirmed weight");
});

check("canonicalization does not fabricate matches for genuinely absent tools", () => {
  const m = matchRequirements(["Xero"], [{ normalizedName: normalizeSkill("QuickBooks"), confirmed: true }]);
  // Xero and QuickBooks are different tools; a QuickBooks skill must not
  // exact-match an Xero requirement just because both are accounting.
  assert.notEqual(m[0].kind, "confirmed");
  assert.notEqual(m[0].kind, "claimed");
});

check("the table knows a sensible number of distinct tools", () => {
  assert.ok(KNOWN_TOOL_COUNT >= 40, `expected >= 40 canonical tools, got ${KNOWN_TOOL_COUNT}`);
});

console.log(`\n${pass} passed`);

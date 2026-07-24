/**
 * Scoring + format guards for the money/ranking core.
 * Run with: node --experimental-strip-types src/lib/scoring.test.ts
 */
import assert from "node:assert/strict";
import { composite, scoreRate, scoreSkills, type Dims } from "./scoring.ts";
import { initials } from "./format.ts";

// ── scoreRate ────────────────────────────────────────────────────────────
// In-band pays full; below-band tapers; over-band decays; nulls are neutral.
assert.equal(scoreRate(10, 8, 12), 100, "in-band -> 100");
assert.equal(scoreRate(8, 8, 12), 100, "min edge in-band");
assert.equal(scoreRate(12, 8, 12), 100, "max edge in-band");
assert.equal(scoreRate(null, 8, 12), 60, "null rate -> neutral 60");
assert.equal(scoreRate(10, null, 12), 60, "null bound -> neutral 60");
assert.equal(scoreRate(9, 10, 20), 90, "just below -> 90"); // under = 0.1
assert.equal(scoreRate(6, 10, 20), 80, "further below -> 80"); // under = 0.4
assert.equal(scoreRate(4, 10, 20), 70, "far below -> 70"); // under = 0.6
assert.equal(scoreRate(21, 10, 20), 70, "just over -> 70"); // overBy = 0.05
assert.equal(scoreRate(26, 10, 20), 35, "over -> 35"); // overBy = 0.3
assert.equal(scoreRate(40, 10, 20), 0, "far over -> 0"); // overBy = 1.0

// An inverted band (min > max) is why /api/jds refuses budgetMin>budgetMax:
// scoreRate can't reach its in-band 100 branch, so a genuinely over-budget
// rate gets scored as a "bargain". Documented here so the API guard isn't
// mistaken for redundant.
assert.notEqual(scoreRate(50, 100, 10), 100, "inverted band never scores in-band");

// ── composite clamp: dims always resolve into 0..100 ──────────────────────
const neg: Dims = { skills: -50, rate: -50, overlap: -50, experience: -50 };
assert.equal(composite(neg), 0, "negative dims clamp to 0");
const over: Dims = { skills: 200, rate: 200, overlap: 200, experience: 200 };
assert.equal(composite(over, true), 100, "over-range dims + bonus clamp to 100");

// ── scoreSkills: no requirements falls back to similarity, clamped ────────
assert.equal(scoreSkills([], [], -0.5), 0, "negative similarity clamps to 0");
assert.equal(scoreSkills([], [], 0.5), 50, "similarity passthrough");

// A confirmed duplicate wins over an unconfirmed one regardless of order, so
// scoring is deterministic if the DB returns two rows with the same name.
const dupConfirmedFirst = scoreSkills(
  ["dentrix"],
  [{ normalizedName: "dentrix", confirmed: true }, { normalizedName: "dentrix", confirmed: false }],
  0.5,
);
const dupConfirmedLast = scoreSkills(
  ["dentrix"],
  [{ normalizedName: "dentrix", confirmed: false }, { normalizedName: "dentrix", confirmed: true }],
  0.5,
);
assert.equal(dupConfirmedFirst, dupConfirmedLast, "duplicate-skill scoring is order-independent");

// ── initials edge cases ───────────────────────────────────────────────────
assert.equal(initials("Kristine Bautista"), "KB", "two words");
assert.equal(initials("Cher"), "C", "single word");
assert.equal(initials(null), "??", "null");
assert.equal(initials("   "), "??", "whitespace only");
// Astral first char yields a whole glyph, not a lone surrogate half.
assert.equal([...initials("𝒜lice Wonder")].length, 2, "astral first char stays one code point");

console.log("scoring + format: OK");

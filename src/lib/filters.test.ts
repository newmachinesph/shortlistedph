import test from "node:test";
import assert from "node:assert/strict";
import { applyHardFilters, jdHardRequirements } from "./filters.ts";

const cand = (id: string, over: Partial<Parameters<typeof applyHardFilters>[0][number]> = {}) => ({
  id,
  rateUsd: 10,
  availability: "open",
  committedHours: 0,
  ...over,
});

test("null hardRequirements eliminates nobody", () => {
  const r = applyHardFilters([cand("a"), cand("b", { rateUsd: 500 })], null);
  assert.equal(r.passed.length, 2);
  assert.equal(r.eliminated.length, 0);
});

test("rate: 1.10x ceiling passes on the tolerance band, 1.50x is eliminated", () => {
  const r = applyHardFilters(
    [cand("near", { rateUsd: 11 }), cand("far", { rateUsd: 15 }), cand("in", { rateUsd: 9 })],
    { rateMaxUsd: 10 },
  );
  assert.deepEqual(r.passed.map((c) => c.id), ["near", "in"]);
  assert.deepEqual(r.eliminated, [{ profileId: "far", reason: "rate_above_ceiling" }]);
});

test("no stated rate is never eliminated on rate", () => {
  const r = applyHardFilters([cand("norate", { rateUsd: null })], { rateMaxUsd: 10 });
  assert.equal(r.passed.length, 1);
  assert.equal(r.eliminated.length, 0);
});

test("hours: free capacity below the minimum eliminates", () => {
  const r = applyHardFilters(
    [cand("busy", { committedHours: 30 }), cand("free", { committedHours: 0 })],
    { hoursPerWeekMin: 20 },
  );
  assert.deepEqual(r.passed.map((c) => c.id), ["free"]);
  assert.deepEqual(r.eliminated, [{ profileId: "busy", reason: "hours_short" }]);
});

test("booked availability eliminates regardless of other fields", () => {
  const r = applyHardFilters([cand("b", { availability: "booked" })], { rateMaxUsd: 100 });
  assert.deepEqual(r.eliminated, [{ profileId: "b", reason: "booked" }]);
});

test("a JD with no stated budget or hours still eliminates booked", () => {
  // jdHardRequirements derives {rateMaxUsd: null, hoursPerWeekMin: null} from a
  // JD that stated neither — an object, so the loop runs, but only availability
  // can eliminate. A zero ceiling is treated the same as none.
  const r = applyHardFilters([cand("open"), cand("b", { availability: "booked" })], {
    rateMaxUsd: 0,
    hoursPerWeekMin: 0,
  });
  assert.deepEqual(r.passed.map((c) => c.id), ["open"]);
  assert.deepEqual(r.eliminated, [{ profileId: "b", reason: "booked" }]);
});

test("startWithinDays never eliminates yet — no profile signal to test", () => {
  const r = applyHardFilters([cand("a")], { startWithinDays: 7 });
  assert.equal(r.passed.length, 1);
});

// The limit is what lets the caller hand in a deeper ANN slice than it needs:
// filtering must reach PAST the shallow cut, never hollow it out.
test("limit stops at N survivors and reports only the eliminations met on the way", () => {
  const r = applyHardFilters(
    [
      cand("over", { rateUsd: 99 }),
      cand("a"),
      cand("b"),
      cand("later-over", { rateUsd: 99 }),
      cand("c"),
    ],
    { rateMaxUsd: 10 },
    2,
  );
  assert.deepEqual(r.passed.map((c) => c.id), ["a", "b"]);
  assert.deepEqual(r.eliminated, [{ profileId: "over", reason: "rate_above_ceiling" }]);
});

test("limit applies with no requirements too", () => {
  const r = applyHardFilters([cand("a"), cand("b"), cand("c")], null, 2);
  assert.deepEqual(r.passed.map((c) => c.id), ["a", "b"]);
});

// ── jdHardRequirements: the mass-elimination regression ──────────────────
// This bug shipped twice. The test is the reason it cannot ship a third time.

test("a stored hoursPerWeekMin never becomes a filter", () => {
  // Exactly what the JD write path stores for "$12/hr ceiling, 40h role".
  const hard = jdHardRequirements({
    budgetMax: 12,
    hardRequirements: { rateMaxUsd: 12, hoursPerWeekMin: 40 },
  });
  assert.equal(hard.rateMaxUsd, 12);
  assert.equal(hard.hoursPerWeekMin ?? null, null);

  // The proof it matters: with the old wholesale return, everyone carrying a
  // single committed hour was eliminated from a routine 40h brief.
  const r = applyHardFilters([cand("committed", { committedHours: 1 }), cand("free")], hard);
  assert.deepEqual(r.passed.map((c) => c.id), ["committed", "free"]);
  assert.deepEqual(r.eliminated, []);
});

test("no stored JSON derives the ceiling from budgetMax", () => {
  const hard = jdHardRequirements({ budgetMax: 20, hardRequirements: null });
  assert.equal(hard.rateMaxUsd, 20);
});

test("a stored ceiling wins over budgetMax", () => {
  const hard = jdHardRequirements({ budgetMax: 20, hardRequirements: { rateMaxUsd: 12 } });
  assert.equal(hard.rateMaxUsd, 12);
});

test("a JD stating no budget at all yields no ceiling", () => {
  const hard = jdHardRequirements({ budgetMax: null });
  assert.equal(hard.rateMaxUsd, null);
  const r = applyHardFilters([cand("pricey", { rateUsd: 400 })], hard);
  assert.deepEqual(r.passed.map((c) => c.id), ["pricey"]);
});

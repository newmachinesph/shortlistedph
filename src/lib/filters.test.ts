import test from "node:test";
import assert from "node:assert/strict";
import { applyHardFilters } from "./filters.ts";

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

test("rate: 1.10x ceiling passes tagged, 1.50x is eliminated", () => {
  const r = applyHardFilters(
    [cand("near", { rateUsd: 11 }), cand("far", { rateUsd: 15 }), cand("in", { rateUsd: 9 })],
    { rateMaxUsd: 10 },
  );
  assert.deepEqual(r.passed.map((c) => c.id), ["near", "in"]);
  assert.ok(r.aboveBudget.has("near"));
  assert.ok(!r.aboveBudget.has("in"));
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

test("startWithinDays never eliminates yet — no profile signal to test", () => {
  const r = applyHardFilters([cand("a")], { startWithinDays: 7 });
  assert.equal(r.passed.length, 1);
});

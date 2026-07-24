/**
 * Openings board leak guard.
 * Run with: node --experimental-strip-types src/lib/openings.test.ts
 *
 * The site promises job descriptions are hidden from candidates. This test is
 * what keeps the public board from breaking that: it proves the mapper exposes
 * only listable fields and refuses to list anything without an approved title.
 * If someone adds an employer field to PublicOpening, a test here should fail.
 */
import assert from "node:assert/strict";
import { toPublicOpening, type PublicOpening } from "./openings-shape.ts";

let pass = 0;
const check = (label: string, fn: () => void) => {
  fn();
  pass++;
  console.log(`  ok  ${label}`);
};

const listed = {
  id: "jd_1",
  publicTitle: "Ecommerce customer support + order ops",
  roleFamily: "ecommerce_ops",
  industry: "ecommerce_apparel",
  clientRegion: "US",
  budgetMin: 8,
  budgetMax: 12,
  hoursPerWeek: 40,
  overlap: "6h US Eastern",
  status: "matching",
  listedAt: new Date("2026-07-20T00:00:00Z"),
};

check("lists an approved opening with only public fields", () => {
  const o = toPublicOpening(listed);
  assert.ok(o);
  assert.equal(o.title, "Ecommerce customer support + order ops");
  assert.equal(o.rateBand, "$8–12/hr");
  assert.equal(o.isMatching, true);
});

check("fails closed when there is no approved public title", () => {
  assert.equal(toPublicOpening({ ...listed, publicTitle: null }), null);
});

check("fails closed when never stamped listed", () => {
  assert.equal(toPublicOpening({ ...listed, listedAt: null }), null);
});

check("the public shape carries no employer-derived field", () => {
  const o = toPublicOpening(listed) as PublicOpening;
  const keys = Object.keys(o);
  // Anything on this list leaking to the board would break the hidden-JD promise.
  for (const forbidden of [
    "employerId",
    "title", // the RAW employer title — o.title is the publicTitle, but there must be no separate raw one
    "mustHaves",
    "niceToHaves",
    "screeningQuestions",
    "initialInstructions",
    "schedulingUrl",
    "budgetMin",
    "budgetMax",
    "publicTitle", // internal name; exposed as `title`
    "employer",
  ]) {
    if (forbidden === "title") continue; // o.title IS allowed (it is the public title)
    assert.ok(!keys.includes(forbidden), `PublicOpening must not expose "${forbidden}"`);
  }
});

check("exposes a coarse rate band, never the exact ceiling", () => {
  const o = toPublicOpening(listed) as PublicOpening;
  // The band is a string like "$8–12/hr"; the raw numbers are absent.
  assert.equal(typeof o.rateBand, "string");
  assert.ok(!("budgetMax" in o));
  assert.ok(!("budgetMin" in o));
});

check("isMatching reflects only live states", () => {
  assert.equal((toPublicOpening({ ...listed, status: "slate_ready" }) as PublicOpening).isMatching, true);
  assert.equal((toPublicOpening({ ...listed, status: "closed" }) as PublicOpening).isMatching, false);
  assert.equal((toPublicOpening({ ...listed, status: "draft" }) as PublicOpening).isMatching, false);
});

console.log(`\n${pass} passed`);

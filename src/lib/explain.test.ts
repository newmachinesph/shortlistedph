/**
 * Deterministic slate explanations.
 * Run with: node --experimental-strip-types src/lib/explain.test.ts
 *
 * The invariant under test: a bullet can only ever name a requirement the
 * employer wrote, classified by the same matchRequirements verdicts the score
 * was computed from. The model-written version this replaced could describe a
 * ranking it had not computed, and one invented reason spotted by an employer
 * discredits every ranking after it (matching spec §7).
 */
import assert from "node:assert/strict";
import { explainMatch, matchRequirements, scoreSkills, type Dims } from "./scoring.ts";

let pass = 0;
const check = (label: string, fn: () => void) => {
  fn();
  pass++;
  console.log(`  ok  ${label}`);
};

const dims = (over: Partial<Dims> = {}): Dims => ({
  skills: 70,
  rate: 100,
  overlap: 100,
  experience: 60,
  ...over,
});

const skill = (name: string, confirmed = false) => ({ name, normalizedName: name.toLowerCase(), confirmed });

const candidate = {
  headline: "Ecommerce support VA",
  yearsExperience: 5,
  rateUsd: 8,
  skills: [skill("gorgias"), skill("shopify", true), skill("zendesk")],
  roles: ["Customer Support Specialist"],
};

// ── the invariant ────────────────────────────────────────────────────────

check("never names a requirement the employer did not write", () => {
  const bullets = explainMatch(
    { mustHaves: ["gorgias", "shipstation"], budgetMax: 10 },
    candidate,
    dims(),
  );
  const text = bullets.join(" ").toLowerCase();
  // Present on the profile, absent from the JD — must not be quoted as a reason.
  assert.ok(!text.includes("zendesk"), "quoted a skill the employer never asked for");
});

check("names a gap it cannot demonstrate, rather than staying silent", () => {
  const bullets = explainMatch(
    { mustHaves: ["gorgias", "shipstation"], budgetMax: 10 },
    candidate,
    dims(),
  );
  const gap = bullets.find((b) => b.startsWith("Gap:"));
  assert.ok(gap, "expected a gap bullet");
  assert.ok(gap.includes("shipstation"), "unmatched must-have must be named");
  assert.ok(!gap.includes("gorgias"), "a matched must-have is not a gap");
});

check("its counts agree with what scoreSkills counted", () => {
  const required = ["gorgias", "shopify", "shipstation"];
  const matches = matchRequirements(required, candidate.skills, { headline: candidate.headline });
  const direct = matches.filter((m) => m.kind === "confirmed" || m.kind === "claimed").length;

  const [first] = explainMatch({ mustHaves: required, budgetMax: 10 }, candidate, dims());
  assert.ok(first.startsWith(`${direct} of ${required.length} must-haves matched`), first);
  // And the score built from the same verdicts is non-zero, i.e. they share a source.
  assert.ok(scoreSkills(required, candidate.skills, 0.5, { headline: candidate.headline }) > 0);
});

check("credits a confirmed engagement only when one exists", () => {
  const [withProof] = explainMatch({ mustHaves: ["shopify"], budgetMax: 10 }, candidate, dims());
  assert.ok(withProof.includes("1 confirmed by a past engagement"), withProof);

  const [without] = explainMatch(
    { mustHaves: ["gorgias"], budgetMax: 10 },
    candidate,
    dims(),
  );
  assert.ok(!without.includes("confirmed by"), without);
});

// ── rate, stated plainly in both directions ──────────────────────────────

check("says within the ceiling when it is", () => {
  const bullets = explainMatch({ mustHaves: ["gorgias"], budgetMax: 10 }, candidate, dims());
  assert.ok(bullets.some((b) => b === "Rate: $8/hr, within your $10 ceiling."), bullets.join(" | "));
});

check("says above the ceiling when it is", () => {
  const bullets = explainMatch(
    { mustHaves: ["gorgias"], budgetMax: 5 },
    candidate,
    dims({ rate: 35 }),
  );
  assert.ok(bullets.some((b) => b === "Rate: $8/hr, above your $5 ceiling."), bullets.join(" | "));
});

check("handles a missing rate and a missing ceiling without inventing either", () => {
  const noRate = explainMatch(
    { mustHaves: ["gorgias"], budgetMax: 10 },
    { ...candidate, rateUsd: null },
    dims(),
  );
  assert.ok(noRate.some((b) => b === "Rate: not set on this profile yet."));

  const noCeiling = explainMatch({ mustHaves: ["gorgias"], budgetMax: null }, candidate, dims());
  assert.ok(noCeiling.some((b) => b === "Rate: $8/hr."));
});

// ── edges ────────────────────────────────────────────────────────────────

check("a requirement-less JD still produces bullets", () => {
  const bullets = explainMatch({ mustHaves: [], budgetMax: 10 }, candidate, dims());
  assert.equal(bullets.length, 3);
  assert.ok(bullets[0].includes("Ranked on overall profile fit"), bullets[0]);
});

check("a full match says so instead of manufacturing a gap", () => {
  const bullets = explainMatch({ mustHaves: ["gorgias", "shopify"], budgetMax: 10 }, candidate, dims());
  assert.ok(bullets.includes("No gaps against your stated must-haves."), bullets.join(" | "));
});

check("flags thin capacity as a gap", () => {
  const bullets = explainMatch(
    { mustHaves: ["gorgias"], budgetMax: 10 },
    candidate,
    dims({ overlap: 30 }),
  );
  const gap = bullets.find((b) => b.startsWith("Gap:"));
  assert.ok(gap?.includes("limited weekly capacity"), bullets.join(" | "));
});

check("singular year reads as a year, not 1 yrs", () => {
  const [first] = explainMatch(
    { mustHaves: ["gorgias"], budgetMax: 10 },
    { ...candidate, yearsExperience: 1 },
    dims(),
  );
  assert.ok(first.includes("1 yr experience"), first);
  assert.ok(!first.includes("1 yrs"), first);
});

check("always returns exactly three bullets", () => {
  for (const mustHaves of [[], ["gorgias"], ["a", "b", "c", "d", "e", "f"]]) {
    assert.equal(explainMatch({ mustHaves, budgetMax: 10 }, candidate, dims()).length, 3);
  }
});

console.log(`\n${pass} passed`);

/**
 * Scoring + format guards for the money/ranking core.
 * Run with: node --experimental-strip-types src/lib/scoring.test.ts
 */
import assert from "node:assert/strict";
import {
  MIN_SLATE_SCORE,
  QUALIFY_SCORE,
  SKILL_COVERAGE_DENOM,
  VERIFIED_BONUS,
  compareRotation,
  composite,
  freeHours,
  rotationCost,
  scoreOverlap,
  scoreRate,
  scoreSkills,
  type Dims,
  type RotationEntry,
} from "./scoring.ts";
// blendSimilarity is tested here rather than beside facets.ts because it exists
// only to feed scoreSkills — its weighting is a ranking decision.
import { FACET_BLEND, blendSimilarity } from "./facets.ts";
import { initials } from "./format.ts";

const close = (a: number, b: number, msg: string) =>
  assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} vs ${b}`);

// ── scoreRate ────────────────────────────────────────────────────────────
// In-band pays full; below-band tapers; over-band decays; nulls are neutral.
assert.equal(scoreRate(10, 8, 12), 100, "in-band -> 100");
assert.equal(scoreRate(8, 8, 12), 100, "min edge in-band");
assert.equal(scoreRate(12, 8, 12), 100, "max edge in-band");
assert.equal(scoreRate(null, 8, 12), 60, "null rate -> neutral 60");
assert.equal(scoreRate(10, null, 12), 60, "null bound -> neutral 60");
assert.equal(scoreRate(10, 8, null), 60, "no stated ceiling -> neutral 60");
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

// ── blendSimilarity: weighting and the un-backfilled COALESCE case ────────
// Weights must sum to 1, because that identity is what makes a profile whose
// facet columns are NULL — all three distances COALESCEd to the whole-profile
// distance — score exactly as it did before facets existed.
close(FACET_BLEND.skills + FACET_BLEND.experience + FACET_BLEND.prefs, 1, "blend weights sum");
close(blendSimilarity(0.3, 0.3, 0.3), 0.7, "identical distances reduce to 1 - d");
close(blendSimilarity(0, 0, 0), 1, "zero distance is perfect similarity");
// Cosine distance runs to 2, so similarity is unclamped and negative at the far
// end — scoreSkills is what clamps it (see the -0.5 case above).
close(blendSimilarity(2, 2, 2), -1, "opposite vectors stay negative");

// Skills dominate: the same distance improvement is worth more on the skills
// facet than on prefs. If this inverts, a JD ranks on timezone preferences.
const base = blendSimilarity(0.5, 0.5, 0.5);
assert.ok(
  blendSimilarity(0.2, 0.5, 0.5) - base > blendSimilarity(0.5, 0.5, 0.2) - base,
  "skills facet must outweigh prefs",
);

// ── scoreSkills: the coverage denominator ─────────────────────────────────
// The calibration anchor thresholds were tuned against (see SKILL_COVERAGE_DENOM):
// every must-have claimed but none confirmed reaches 63, not the 50 it capped
// at when the denominator was CONFIRMED_SKILL_WEIGHT. Change the denominator
// and 68/55 need re-deriving — that is what this pins.
const claimed = [
  { normalizedName: "alpha", confirmed: false },
  { normalizedName: "beta", confirmed: false },
];
const confirmed = claimed.map((s) => ({ ...s, confirmed: true }));
assert.equal(SKILL_COVERAGE_DENOM, 1.5, "coverage denominator moved — re-derive the thresholds");
assert.equal(scoreSkills(["alpha", "beta"], claimed, 0.5), 63, "fully claimed -> 63");
assert.equal(scoreSkills(["alpha", "beta"], confirmed, 0.5), 100, "confirmation is the bonus");
assert.ok(
  scoreSkills(["alpha", "beta"], [claimed[0]], 0.5) < scoreSkills(["alpha", "beta"], claimed, 0.5),
  "covering half the must-haves scores below covering all of them",
);
// The denominator divides by requirement COUNT, so a longer must-have list is
// harder to cover — one match out of four cannot score like one out of one.
assert.ok(
  scoreSkills(["alpha", "b1", "b2", "b3"], [claimed[0]], 0.5) <
    scoreSkills(["alpha"], [claimed[0]], 0.5),
  "coverage denominator scales with the number of requirements",
);

// ── free hours: one definition, shared with the Stage 0 hours filter ──────
assert.equal(freeHours(0), 40, "nothing committed -> a full week free");
assert.equal(freeHours(50), 0, "over-committed never goes negative");
// The filter eliminates below hoursPerWeekMin; the score must agree at the same
// arithmetic, or a candidate is scored as having hours they were filtered on.
assert.equal(scoreOverlap("open", 30, 10), 100, "10 free hours covers a 10-hour job");
assert.equal(scoreOverlap("open", 30, 20), 50, "half the hours needed -> half the score");

// ── tiering: the two bars only mean something apart ───────────────────────
// MIN_SLATE_SCORE tiers who fills a slate first, QUALIFY gates who is eligible
// at all. Collapse the gap and the backfill tier disappears silently.
assert.ok(QUALIFY_SCORE < MIN_SLATE_SCORE, "eligibility bar must sit below the strong bar");
// Verification is a tiebreaker: it must never be able to lift a merely-eligible
// candidate into the strong tier on identity alone.
assert.ok(VERIFIED_BONUS < MIN_SLATE_SCORE - QUALIFY_SCORE, "verified bonus cannot buy a tier");

// ── rotation: a turn costs a turn ─────────────────────────────────────────
const at = (ms: number | null) => (ms == null ? null : new Date(ms));
const rot = (
  invites: number,
  placements: number,
  over: Partial<RotationEntry> & { invitedAt?: number | null; shownAt?: number | null } = {},
): RotationEntry => ({
  c: {
    inviteCount: invites,
    shortlistCount: placements,
    lastInvitedAt: at(over.invitedAt ?? null),
    lastShownAt: at(over.shownAt ?? null),
  },
  fresh: over.fresh ?? false,
  score: over.score ?? 70,
});

const order = (entries: [string, RotationEntry][]): string[] =>
  [...entries].sort((a, b) => compareRotation(a[1], b[1])).map(([name]) => name);

// The bug this replaced: shortlistCount stamps only on accept, so a candidate
// who declines everything stayed at 0 forever and led EVERY slate.
assert.deepEqual(
  order([
    ["decliner", rot(3, 0, { invitedAt: 3 })],
    ["placed-once", rot(1, 1, { invitedAt: 1, shownAt: 2 })],
  ]),
  ["placed-once", "decliner"],
  "three declines cost more rotation priority than one placement",
);

// …but declining is still cheaper than accepting the same invitation, so saying
// no is never punished the way silence is (dormancy) or acceptance is.
assert.deepEqual(
  order([
    ["accepted", rot(1, 1, { invitedAt: 1, shownAt: 1 })],
    ["declined", rot(1, 0, { invitedAt: 1 })],
  ]),
  ["declined", "accepted"],
  "declining costs strictly less than accepting the same invite",
);
assert.ok(rotationCost({ inviteCount: 1, shortlistCount: 0 }) < rotationCost({ inviteCount: 1, shortlistCount: 1 }));

// Never asked = front of the queue, which is the whole point of rotating.
assert.deepEqual(
  order([
    ["veteran", rot(2, 1, { invitedAt: 5 })],
    ["newcomer", rot(0, 0)],
  ]),
  ["newcomer", "veteran"],
  "a candidate nobody has invited leads the rotation",
);

// Equal cost falls to who has waited longest, and the stamp is the LATER of the
// two — consent rows die with their JD, so neither alone is the whole story.
assert.deepEqual(
  order([
    ["recent", rot(1, 0, { invitedAt: 900 })],
    ["waiting", rot(1, 0, { invitedAt: 100 })],
  ]),
  ["waiting", "recent"],
  "equal turns -> longest-waiting first",
);
assert.deepEqual(
  order([
    ["stale-invite-recent-placement", rot(1, 1, { invitedAt: 10, shownAt: 900 })],
    ["both-old", rot(1, 1, { invitedAt: 100, shownAt: 100 })],
  ]),
  ["both-old", "stale-invite-recent-placement"],
  "last turn is the later of the invite and placement stamps",
);

// Freshness is a nudge and score is the last word — neither can jump the queue.
assert.deepEqual(
  order([
    ["stale", rot(1, 0, { invitedAt: 100, score: 99 })],
    ["fresh", rot(1, 0, { invitedAt: 100, fresh: true, score: 60 })],
  ]),
  ["fresh", "stale"],
  "freshness nudges ahead of a higher score at equal standing",
);
assert.deepEqual(
  order([
    ["weaker", rot(1, 0, { invitedAt: 100, score: 60 })],
    ["stronger", rot(1, 0, { invitedAt: 100, score: 90 })],
  ]),
  ["stronger", "weaker"],
  "score is the final tiebreaker only",
);

// ── initials edge cases ───────────────────────────────────────────────────
assert.equal(initials("Kristine Bautista"), "KB", "two words");
assert.equal(initials("Cher"), "C", "single word");
assert.equal(initials(null), "??", "null");
assert.equal(initials("   "), "??", "whitespace only");
// Astral first char yields a whole glyph, not a lone surrogate half.
assert.equal([...initials("𝒜lice Wonder")].length, 2, "astral first char stays one code point");

console.log("scoring + format: OK");

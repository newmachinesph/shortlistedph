/**
 * Pure match scoring. No db, no network, no framework — so the evaluation
 * harness and tests can import the exact logic production ranks with.
 */
import { canonicalizeTool, isKnownTool } from "./tools/aliases.ts";

export type Dims = { skills: number; rate: number; overlap: number; experience: number };

/** Keep every dimension in the 0–100 range the UI and thresholds assume. */
const clamp100 = (n: number): number => Math.max(0, Math.min(100, n));

/**
 * Every dimension shown in the UI actually counts. The previous platform
 * computed four dimensions and multiplied two of them by zero.
 */
export const WEIGHTS = { skills: 0.45, experience: 0.2, rate: 0.2, overlap: 0.15 } as const;

/** A skill backed by a mutual outcome confirmation outweighs a typed claim. */
export const CONFIRMED_SKILL_WEIGHT = 2;

/**
 * Coverage denominator. A candidate's earned skill weight is divided by
 * `required.length * SKILL_COVERAGE_DENOM`. Below CONFIRMED_SKILL_WEIGHT on
 * purpose: at 2 (the old value), a candidate who matched every must-have but had
 * none outcome-confirmed capped at coverage 0.5 → skills ~50, and the whole
 * migrated pool — which predates the confirmation loop — sat pinned under it
 * (see docs/engine/eval-canonical-result.md). At 1.5 a fully-claimed match
 * reaches coverage 0.67 (skills ~62) while a fully-confirmed match still caps at
 * 1.0 (skills ~88): confirmation is the bonus, not the entry price.
 */
export const SKILL_COVERAGE_DENOM = 1.5;

export const normalizeSkill = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9+#. ]/g, "").replace(/\s+/g, " ").trim();

/**
 * Words that carry no matching signal in requirement phrasing. Employers write
 * "US dental practice experience"; the discriminating tokens are dental and
 * practice, not us and experience.
 */
const STOPWORDS = new Set([
  "a", "an", "and", "or", "the", "of", "in", "on", "for", "with", "to", "at",
  "experience", "experienced", "knowledge", "skills", "skill", "ability", "able",
  "strong", "solid", "good", "excellent", "proven", "years", "year", "yrs",
  "plus", "must", "have", "has", "using", "use", "used", "work", "working",
  "us", "usa", "uk", "au", "comfort", "comfortable", "familiar", "familiarity",
]);

const contentTokens = (phrase: string): string[] =>
  normalizeSkill(phrase)
    .split(" ")
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));

/**
 * The canonical tools named in a list of free-text phrases (engine-plan 2a).
 * Two exact table lookups per phrase, nothing fuzzier: the whole normalized
 * phrase, then the phrase with stopwords stripped, so "Zendesk experience"
 * maps to zendesk while "attention to detail" maps to nothing. A phrase the
 * table doesn't know contributes nothing — unmapped stays prose, never a
 * guess, because a wrong merge scores people for tools they don't have.
 */
export function extractCanonicalTools(phrases: string[]): string[] {
  const out = new Set<string>();
  for (const phrase of phrases) {
    const whole = normalizeSkill(phrase);
    if (isKnownTool(whole)) {
      out.add(canonicalizeTool(whole));
      continue;
    }
    const stripped = contentTokens(phrase).join(" ");
    if (isKnownTool(stripped)) out.add(canonicalizeTool(stripped));
  }
  return [...out];
}

/**
 * Two content words match when they are equal or one is a prefix of the other
 * (both ≥ 4 chars). A cheap stemmer: it makes "refunds" meet "refund",
 * "scheduling" meet "schedule", "processing" meet "process" — the wording
 * differences that were silently dropping qualified people. The length floor
 * keeps it from matching on fragments ("art" in "smart").
 */
const STEM_MIN = 4;
const tokenHit = (t: string, corpus: Set<string>): boolean => {
  if (corpus.has(t)) return true;
  if (t.length < STEM_MIN) return false;
  for (const c of corpus) {
    if (c.length >= STEM_MIN && (t.startsWith(c) || c.startsWith(t))) return true;
  }
  return false;
};

/**
 * How well a candidate covers the job's must-haves.
 *
 * Requirements are prose ("US dental practice experience") while skills are
 * tags ("Dentrix"), so exact tag matching alone scores almost everyone near
 * zero. Each requirement is therefore matched against the candidate's whole
 * searchable text — skills, headline, and past role titles — and earns partial
 * credit for the share of its content words that appear.
 *
 * A confirmed skill still outranks a self-reported one: only a mutual outcome
 * confirmation earns the full weight.
 */
export type RequirementMatch = {
  requirement: string;
  /** exact tag hit, loose token overlap, or nothing at all. */
  kind: "confirmed" | "claimed" | "partial" | "none";
  /** Contribution to the coverage numerator. */
  weight: number;
};

/**
 * Per-requirement verdicts, the shared source for both the skills score and the
 * "why this person ranked" bullets.
 *
 * One function so the explanation can never claim a match the score did not
 * count, or omit a gap the score penalised. Splitting these was how the old
 * narration drifted from the ranking it was describing.
 */
export function matchRequirements(
  required: string[],
  candidateSkills: { normalizedName: string; confirmed: boolean }[],
  context: { headline?: string | null; roles?: string[] } = {},
): RequirementMatch[] {
  // Confirmed always wins on a duplicate normalizedName, so scoring is
  // deterministic regardless of DB row order if two rows share a name. Keyed by
  // canonical tool, so "QBO" and "QuickBooks Online" land in the same bucket
  // and an exact must-have match finally fires (see tools/aliases.ts).
  const owned = new Map<string, boolean>();
  for (const s of candidateSkills) {
    const key = canonicalizeTool(s.normalizedName);
    owned.set(key, (owned.get(key) ?? false) || s.confirmed);
  }
  const corpus = new Set<string>();
  for (const s of candidateSkills) for (const t of contentTokens(s.normalizedName)) corpus.add(t);
  for (const t of contentTokens(context.headline ?? "")) corpus.add(t);
  for (const role of context.roles ?? []) for (const t of contentTokens(role)) corpus.add(t);

  return required.map((requirement) => {
    const exact = owned.get(canonicalizeTool(normalizeSkill(requirement)));
    if (exact !== undefined) {
      return exact
        ? { requirement, kind: "confirmed" as const, weight: CONFIRMED_SKILL_WEIGHT }
        : { requirement, kind: "claimed" as const, weight: 1 };
    }
    // Partial credit: how much of this requirement shows up anywhere on the
    // profile, tolerant to plural/gerund wording (see tokenHit). Partial always
    // scores below an exact confirmed match — coverage divides by the confirmed
    // weight — so a loose match lifts a qualified person without outranking a
    // proven one.
    const tokens = contentTokens(requirement);
    if (tokens.length === 0) return { requirement, kind: "none" as const, weight: 0 };
    const hits = tokens.filter((t) => tokenHit(t, corpus)).length;
    const weight = (hits / tokens.length) * 1;
    return { requirement, kind: weight > 0 ? ("partial" as const) : ("none" as const), weight };
  });
}

export function scoreSkills(
  required: string[],
  candidateSkills: { normalizedName: string; confirmed: boolean }[],
  similarity: number,
  context: { headline?: string | null; roles?: string[] } = {},
): number {
  if (required.length === 0) return clamp100(Math.round(similarity * 100));

  const matches = matchRequirements(required, candidateSkills, context);
  const earned = matches.reduce((sum, m) => sum + m.weight, 0);
  const coverage = earned / (required.length * SKILL_COVERAGE_DENOM);

  // Embedding similarity still contributes — it catches synonyms that share no
  // tokens at all ("QBO" vs "QuickBooks Online").
  return clamp100(Math.round(Math.min(1, coverage * 0.75 + similarity * 0.25) * 100));
}

export function scoreRate(rate: number | null, min: number | null, max: number | null): number {
  if (rate == null || min == null || max == null) return 60;
  if (rate >= min && rate <= max) return 100;

  if (rate < min) {
    // Cheaper is good, but not better than a candidate who priced themselves
    // into the band. Far below usually signals a seniority mismatch rather
    // than a bargain, so the bonus tapers instead of sitting flat at 95.
    const under = (min - rate) / min;
    if (under <= 0.25) return 90;
    if (under <= 0.5) return 80;
    return 70;
  }

  const overBy = (rate - max) / max;
  if (overBy <= 0.15) return 70;
  if (overBy <= 0.4) return 35;
  return 0;
}

export function scoreOverlap(
  availability: string,
  committed: number,
  hoursNeeded: number | null,
): number {
  const free = Math.max(0, 40 - committed);
  if (availability === "booked") return 10;
  if (!hoursNeeded) return availability === "open" ? 100 : 70;
  if (free >= hoursNeeded) return 100;
  return Math.round((free / hoursNeeded) * 100);
}

export function scoreExperience(years: number, confirmedEngagements: number): number {
  const base = Math.min(1, years / 5) * 80;
  const proof = Math.min(20, confirmedEngagements * 10);
  return Math.round(base + proof);
}

/**
 * The "strong match" bar — a candidate below this is padding rather than a
 * genuine match.
 *
 * Returning five names regardless of quality is how job boards waste an
 * employer's time. Against the real pool an Amazon PPC brief surfaced a
 * recruiter and a postal-services generalist at ~59 — one look at that and an
 * employer stops trusting every future slate. A short honest slate, or none at
 * all, is worth more than a padded one.
 *
 * Wired in buildSlate (lib/matching.ts) as a tiering preference: candidates at
 * or above this fill slate slots first (in rotation order), and QUALIFY..MIN
 * candidates only backfill when there aren't enough strong ones. Eligibility
 * itself is still QUALIFY_SCORE — this only orders who gets shown first.
 *
 * Recalibrated 2026-07-25 for the coverage-denominator rework: a fully-claimed
 * match gained ~13 skills points (52 → 65 ceiling), which is +6 composite at
 * the 0.45 skills weight, so the old 62 moved to 68. Measured on the
 * 785-profile prod pool: strong counts fell from 5/18/11/6 to 2/10/5/3 across
 * the four fillable eval jobs — "strong" means top-tier again instead of
 * two-thirds of everyone eligible.
 */
export const MIN_SLATE_SCORE = 68;

/**
 * The eligibility bar for rotation, set below the strong-match cutoff.
 *
 * Two thresholds, two jobs. MIN_SLATE_SCORE (68) marks a *strong* match and
 * tiers who fills a slate first. QUALIFY (55) is the eligibility bar and marks
 * *eligible*: good enough to put in front of an employer, even if not the
 * single best on paper. Everyone
 * at or above QUALIFY enters the rotation so the same top profiles don't fill
 * every slate — but nobody below it does, so fairness never ships a bad fit.
 *
 * Tuned against the real pool with scripts/eval-matching.ts (EVAL_DB=prod).
 * Recalibrated 2026-07-25 for the coverage-denominator rework: a mid-coverage
 * partial match gained ~7 skills points, i.e. +3 composite, so the old 52
 * moved to 55. On the prod pool this restores the margin against the padding
 * boundary (a near-domain reject sits at 51) while keeping every fillable
 * eval job at a full slate; the one candidate it drops scored 54 with only
 * partial coverage — below anything the old bar ever admitted.
 */
export const QUALIFY_SCORE = 55;

/**
 * Domain gate: a qualifying candidate must also show real skill overlap, not
 * just a good rate and long tenure. Without this, a wrong-domain profile can
 * pad past QUALIFY on rate + experience + availability alone (the recruiter who
 * surfaced on an Amazon PPC brief). The support example scores skills 54 here;
 * pure padding scores ~10–15. 40 keeps genuine partial matches while cutting
 * off-domain padding — quality gating eligibility, exactly as intended.
 *
 * Deliberately NOT moved in the 2026-07-25 recalibration: on the prod pool the
 * post-rework distribution is bimodal around it — every eligible candidate
 * scores skills ≥ 43, every gated reject ≤ 37 (Amazon PPC's best is 37). The
 * gate still separates cleanly; only the composite thresholds had drifted.
 */
export const QUALIFY_SKILLS = 40;

/**
 * Verified identity is a tiebreaker, not a dimension.
 *
 * Kept small on purpose. A bigger bonus would let verification outrank a
 * genuinely better match, which is both bad ranking and — because verification
 * currently costs the worker money — the thing that turns an optional fee into
 * a fee for placement. See docs/research/verification.md.
 */
export const VERIFIED_BONUS = 4;

/** "a, b and c" — or "a, b, c and 2 more" once the list runs long. */
function nameList(items: string[], cap = 3): string {
  const shown = items.slice(0, cap);
  const extra = items.length - shown.length;
  const joined =
    shown.length > 1 ? `${shown.slice(0, -1).join(", ")} and ${shown.at(-1)}` : (shown[0] ?? "");
  return extra > 0 ? `${joined} and ${extra} more` : joined;
}

/**
 * The "why this person ranked" bullets an employer reads on a slate.
 *
 * Derived entirely from the stored numbers. A model asked to justify a ranking
 * it did not compute will write a plausible reason, and one invented reason
 * caught by an employer discredits every ranking after it — so this reads the
 * same `matchRequirements` verdicts the score was built from, and can only name
 * requirements that came from the employer's own job description.
 *
 * Gaps are stated plainly. An honest flag is what makes the rest believable.
 */
export function explainMatch(
  jd: { mustHaves: string[]; budgetMax: number | null },
  c: {
    headline?: string | null;
    yearsExperience: number;
    rateUsd: number | null;
    skills: { name: string; normalizedName?: string; confirmed: boolean }[];
    roles?: string[];
  },
  dims: Dims,
): string[] {
  const skills = c.skills.map((s) => ({
    normalizedName: s.normalizedName ?? normalizeSkill(s.name),
    confirmed: s.confirmed,
  }));
  const matches = matchRequirements(jd.mustHaves, skills, {
    headline: c.headline,
    roles: c.roles,
  });

  const direct = matches.filter((m) => m.kind === "confirmed" || m.kind === "claimed");
  const confirmed = matches.filter((m) => m.kind === "confirmed");
  const partial = matches.filter((m) => m.kind === "partial");
  const gaps = matches.filter((m) => m.kind === "none");

  const years = `${c.yearsExperience} yr${c.yearsExperience === 1 ? "" : "s"} experience`;
  const out: string[] = [];

  if (jd.mustHaves.length === 0) {
    out.push(`${years}. Ranked on overall profile fit (${dims.skills}/100 on skills).`);
  } else {
    const names = direct.length ? ` — ${nameList(direct.map((m) => m.requirement))}` : "";
    const proof = confirmed.length
      ? `, ${confirmed.length} confirmed by a past engagement`
      : "";
    out.push(
      `${direct.length} of ${jd.mustHaves.length} must-haves matched${names}${proof}. ${years}.`,
    );
  }

  const shortfalls: string[] = [];
  if (gaps.length) shortfalls.push(`no evidence of ${nameList(gaps.map((m) => m.requirement))}`);
  if (partial.length) {
    shortfalls.push(`related but not direct experience for ${nameList(partial.map((m) => m.requirement))}`);
  }
  if (dims.overlap < 50) shortfalls.push("limited weekly capacity for your hours");
  out.push(
    shortfalls.length
      ? `Gap: ${shortfalls.join("; ")}.`
      : "No gaps against your stated must-haves.",
  );

  if (c.rateUsd == null) {
    out.push("Rate: not set on this profile yet.");
  } else if (jd.budgetMax == null) {
    out.push(`Rate: $${c.rateUsd}/hr.`);
  } else {
    const within = c.rateUsd <= jd.budgetMax;
    out.push(
      `Rate: $${c.rateUsd}/hr, ${within ? "within" : "above"} your $${jd.budgetMax} ceiling.`,
    );
  }

  return out;
}

export function composite(d: Dims, isVerified = false): number {
  const base =
    d.skills * WEIGHTS.skills +
    d.experience * WEIGHTS.experience +
    d.rate * WEIGHTS.rate +
    d.overlap * WEIGHTS.overlap;
  return clamp100(Math.round(base + (isVerified ? VERIFIED_BONUS : 0)));
}

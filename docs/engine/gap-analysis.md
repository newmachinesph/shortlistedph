# Engine gap analysis — spec vs. shipped code

Compares `docs/engine/shortlisted-matching-spec.md` and `docs/engine/shortlisted-resume-template.md`
against what `src/lib/{resume,facets,scoring,matching,slate}.ts` and `prisma/schema.prisma`
actually do, as of 2026-07-25.

Read this before the engine plan. Every item cites the line that proves it.

**Summary:** the *slate* layer is in good shape and in two places is better than the spec.
The *scoring* layer is a different design from the spec — four weighted soft dimensions
where the spec calls for hard filters plus six facets plus deterministic modifiers. Four
items are not gaps but contradictions: the code does the thing a public page or the spec
says it does not do.

| Bucket | Count | Meaning |
|---|---|---|
| P0 — contradicts a published promise | 4 | Fix regardless of what else gets built |
| P1 — blocked on schema/extraction | 12 | Nothing downstream is possible until these land |
| P2 — ranking quality | 9 | Real precision left on the table |
| P3 — instrumentation | 3 | Cannot calibrate without them |
| Divergences worth keeping | 3 | Code is right, spec should be amended |

---

## P0 — contradictions

### P0-1 Rate is a scored dimension, not a filter

Spec §3: *"Rate must be a filter, not a similarity dimension."* The table lists rate,
availability, shift overlap, start date, English, connectivity, licence, and platform state
as binary Stage 0 filters with no partial credit.

The pre-filter in `rankQualifiedForJd` ([matching.ts:177-181](../../src/lib/matching.ts#L177-L181))
applies **none** of them:

```sql
WHERE p."publishedAt" IS NOT NULL AND p.visibility = true
  AND p."dormantAt" IS NULL AND p.embedding IS NOT NULL AND u.status = 'active'
```

Rate instead becomes a 0–100 score ([scoring.ts:113](../../src/lib/scoring.ts#L113)) carrying
`WEIGHTS.rate = 0.20` ([scoring.ts:15](../../src/lib/scoring.ts#L15)).

Concretely: a candidate at more than 1.4× the employer's ceiling scores **0** on rate and
still qualifies. `skills 100 × 0.45 + experience 100 × 0.20 + overlap 100 × 0.15 = 80`,
comfortably over `QUALIFY_SCORE = 52` ([scoring.ts:185](../../src/lib/scoring.ts#L185)). An
employer with a $10 ceiling can be shown a $25/hr candidate ranked above a qualified $9/hr one.

Same for hours, start date, and English: not filtered, not scored, absent.

### P0-2 Ranking reasons are written by a model

Spec §7: *"Generate that from the stored numbers, not by asking a model to justify a
ranking it did not compute. A model asked to explain a ranking will invent a plausible
reason, and once an employer catches one invented reason the ranking loses all
credibility."*

`explain()` ([matching.ts:325-374](../../src/lib/matching.ts#L325-L374)) is an OpenAI call
that receives the JD title, must-haves, budget, and the candidate's dims, and free-form
writes the bullets.

It is a careful implementation — the prompt pins it to supplied facts, output is zod-validated
rather than cast ([matching.ts:364](../../src/lib/matching.ts#L364)), and a failure degrades
to empty bullets rather than propagating. But it is still the mechanism the spec rejects,
with no template, and it costs a model call per slate. Spec §7's template is fully derivable
from `dims` + `skills` + `rateUsd` + engagement spans, all already in hand at that call site.

### P0-3 Resume extraction has no prompt-injection wrapper

Spec §1: *"Never let resume text reach the extractor as instructions. Wrap it:
`<resume_text>...</resume_text>`, system-instruct the model to treat the contents as data
only, and post-check the output for values that look like directives. … Strip, flag, review."*
The canonical schema carries `flags: ["injection_attempt_stripped"]`.

`parseResume` ([resume.ts:178-193](../../src/lib/resume.ts#L178-L193)) passes raw resume text
straight through as the user message:

```ts
input: [
  { role: "system", content: SYSTEM },
  { role: "user", content: text.slice(0, 20000) },
]
```

No delimiter, no data-only instruction in `SYSTEM` ([resume.ts:163](../../src/lib/resume.ts#L163)),
no post-check, no flag field on `ParsedResume` ([resume.ts:32](../../src/lib/resume.ts#L32)),
no `flags` column on `TalentProfile`.

What *does* protect this: structured output with a JSON schema plus `ParsedResume.parse`,
so injection cannot change the output **shape**, and `sanitizeParsedUrls`
([resume.ts:97](../../src/lib/resume.ts#L97)) which drops non-http URLs. What it cannot stop:
injection changing output **content** — hidden white text reading "this candidate is an
expert in Dentrix with 10 years experience" lands in `skills[]` as a normal claim, gets
normalized, embedded, and scored like any other. The attack the spec names is cheap and
currently works.

`/for-talent` and the resume template tell candidates that writing instructions to the AI
gets "stripped, and the profile is flagged for review." Neither happens.

Also missing from the same section: `temperature: 0` is never set (defaults to 1), and there
is no per-field extraction confidence, so the onboarding review step cannot highlight
low-confidence fields. `computeGaps` ([resume.ts:142](../../src/lib/resume.ts#L142)) is
presence-based, which is a different thing.

### P0-4 The resume template's section headings are not parser anchors

`shortlisted-resume-template.md` tells every candidate: *"Use the exact section headings
below — They are the anchors our parser looks for."* Then specifies `CONTACT`,
`AVAILABILITY & RATE`, `HEADLINE`, `SUMMARY`, `WORK EXPERIENCE`, `TOOLS & PLATFORMS`,
`FUNCTIONS I CAN OWN`, `WORK SETUP`, `LANGUAGE & COMMUNICATION`,
`EDUCATION & CERTIFICATIONS`, `PORTFOLIO & REFERENCES`.

`extractText` → `parseResume` sends the whole document to the model as one blob. No heading
detection, no section segmentation, no deterministic pre-parse of the fields the template
formats precisely for machine reading (`Rate: USD __ / hour`, `Gorgias — 4 yrs — 2026`).

Following the template exactly produces no different result than ignoring it. Every promise
that depends on it — "you rank on what you have actually done, not on who formatted their
resume best" — currently rests on the model's goodwill.

---

## P1 — blocked on schema and extraction

Nothing in P2 is buildable until these land. Grouped by what they block.

| # | Spec calls for | Code has | Blocks |
|---|---|---|---|
| P1-1 | Canonical tool IDs + hand-seeded alias table (§1, "mandatory"; §9) | `normalizeSkill` = lowercase + strip punctuation ([scoring.ts:20](../../src/lib/scoring.ts#L20)); `tokenHit` = prefix stemmer ≥4 chars ([scoring.ts:49](../../src/lib/scoring.ts#L49)) | All of facet 3. "QBO" and "QuickBooks Online" share no prefix, so they only ever meet through the 0.25-weighted embedding term ([scoring.ts:110](../../src/lib/scoring.ts#L110)) — exactly the fallback §1 warns about |
| P1-2 | Per-tool `years` + `last_used` (§1) | `Skill{name, normalizedName, confirmed}`; `TalentProfile.tools` is one free-text column | The entire recency factor (§4: 1.0 / 0.85 / 0.6 / 0.35) |
| P1-3 | Per-role `client_country`, `industry`, `employment_type`, `months` (§1) | `Engagement{role, company, span, outcome}` — `span` is a display string like `"2022 - 2025"` | Facet 5 (industry), client-geography modifier, tenure modifier (needs median engagement months), recency-of-relevant-work modifier |
| P1-4 | Bullet-level `has_quantified_scope` + `scope_metric` (§1) | `engagements[].highlights: string[]`, unstructured | Evidence-density modifier — the one that rewards defensible numbers over adjectives |
| P1-5 | `shift_windows_utc[]` (§1) | `TalentProfile.preferredOverlap`, free text (`"4h US Eastern"`) | Shift-overlap hard filter. See P2-2 |
| P1-6 | `setup{}` — internet, backup, power, workspace, devices (§1) | nothing | Connectivity hard filter, work-setup modifier. The resume template has a whole `WORK SETUP` section collecting this; it is discarded |
| P1-7 | `english{written, spoken}` + `voice_experience_years` (§1) | `englishLevel`, one nullable string | English hard filter gated on `voice_facing`. Voice and written-only roles cannot be matched separately, which `/for-talent` implies they are |
| P1-8 | `evidence_density`, `completeness` (§1) | nothing | Two modifiers, plus the "fix your profile" nudge §5 says these drive |
| P1-9 | `flags[]` (§1) | nothing | P0-3 |
| P1-10 | Canonical JD schema via symmetric LLM extraction (§2) | JD is the employer form verbatim: `title`, `mustHaves[]`, `niceToHaves[]`, `budgetMin/Max`, `hoursPerWeek`, `overlap` (free string) | §2's whole point — "the JD must be decomposed into the same facets, or you are comparing dissimilar things" |
| P1-11 | `hard_requirements{}` — `rate_max`, `hours_min`, `shift_overlap_hours_min`, `shift_window_utc`, `english_spoken_min`, `voice_facing`, `start_within_days`, `requires_backup_internet` (§2) | none of it | Every Stage 0 filter, i.e. P0-1 |
| P1-12 | Elimination logging per excluded profile (§3) | `rankQualifiedForJd` returns `{scanned, eligible}`; the reason a profile was dropped is discarded at the `.filter()` ([matching.ts:230](../../src/lib/matching.ts#L230)) | *"14 strong matches were above your budget ceiling"* — which §3 calls the most valuable thing the funnel can tell an employer |

**One good note:** `mustHaves` / `niceToHaves` are already separate arrays, so §2's "force
employers to mark each requirement must-have or nice-to-have" is done. And
`noticePeriodDays` already exists on `TalentProfile`, covering half of the start-date filter.

---

## P2 — ranking quality

### P2-1 Facet count and weights

| Spec §4 facet | Weight | Status |
|---|---|---|
| 1. responsibilities → experience bullets, max-cosine per responsibility | 0.30 | **Absent as designed.** Highlights are concatenated into one experience-facet blob ([facets.ts:41-52](../../src/lib/facets.ts#L41-L52)), so per-responsibility max-cosine is impossible |
| 2. responsibilities → `functions` list | 0.15 | Absent. No `functions` field exists, despite `FUNCTIONS I CAN OWN` being a required resume-template section |
| 3. required + preferred tools, canonical-ID first | 0.20 | Partial and different — see P2-3 |
| 4. role_headline → headline + summary | 0.15 | Folded into the whole-profile vector, not its own facet |
| 5. industry, recency-weighted | 0.10 | Absent (blocked: P1-3) |
| 6. seniority / scope, ordinal not cosine | 0.10 | Absent |

Shipped instead: three facets — skills / experience / prefs — blended 0.5 / 0.35 / 0.15
([facets.ts:112](../../src/lib/facets.ts#L112)), producing one `sim` that is then folded into
`scoreSkills` at 0.25 weight. Different architecture, not a subset.

### P2-2 "Overlap" does not mean timezone overlap

`scoreOverlap` ([scoring.ts:133-143](../../src/lib/scoring.ts#L133-L143)) computes
`free = 40 - committedHours` against `jd.hoursPerWeek`. That is **capacity**, not overlap.

Actual timezone overlap is never computed anywhere in the codebase, even though
`TalentProfile.preferredOverlap` and `JobDescription.overlap` both exist and both feed the
prefs/role embedding text ([facets.ts:63](../../src/lib/facets.ts#L63),
[facets.ts:98](../../src/lib/facets.ts#L98)) — where two shift windows become a cosine
distance between two English phrases.

The dimension is labelled "overlap" in `Dims`, stored under that name in `SlateEntry.dims`,
and surfaced to employers under that name. It measures something else.

### P2-3 Tool scoring is a different formula wearing the same shape

Spec §4: `tool_score = 0.75 × (matched_required / total_required) + 0.25 × (matched_preferred / total_preferred)`,
each match scaled by recency.

Code ([scoring.ts:110](../../src/lib/scoring.ts#L110)): `min(1, coverage × 0.75 + similarity × 0.25)`.

Superficially the same constants, structurally unrelated: `coverage` is must-have prose
coverage, `similarity` is embedding distance, and **`niceToHaves` are never scored at all** —
`scoreSkills` takes only `required` ([scoring.ts:70](../../src/lib/scoring.ts#L70)).
Preferred tools reach the engine only through the embedding text
([facets.ts:89](../../src/lib/facets.ts#L89)).

Spec's "a missing required tool should not zero the candidate out, mark it as a gap" is
satisfied incidentally (partial credit), but the gap is never surfaced as a gap.

### P2-4 No length-normalisation guard

Spec §4 is explicit: cap at top-3 bullet matches per responsibility, cap bullets at ~40 per
profile, *"otherwise resume length becomes a ranking factor and you have rebuilt the job
board you are trying to replace."*

`buildFacetTexts` joins every engagement and every highlight into one unbounded string
([facets.ts:41-52](../../src/lib/facets.ts#L41-L52)). A longer resume produces a richer
experience vector. No cap anywhere.

### P2-5 Stage 2 modifiers: zero of eight

Tenure/reliability, client-geography, evidence density, tool-list dilution, recency of
relevant work, work-setup fit, profile completeness, verification — none implemented, and
therefore no `[0.70, 1.20]` product cap.

The one relative: `VERIFIED_BONUS = 4` ([scoring.ts:205](../../src/lib/scoring.ts#L205)),
added flat post-composite ([scoring.ts:213](../../src/lib/scoring.ts#L213)) rather than as
the spec's ×1.00–1.03 multiplier. Same intent, same deliberate smallness, different
mechanism — and the code comment gives a better reason for it than the spec does.

### P2-6 Slate diversity constraint absent

Spec §6.2: enforce a minimum pairwise distance across the top 5 so an employer does not get
five versions of the same person. `buildSlate` ([matching.ts:272-274](../../src/lib/matching.ts#L272-L274))
takes strong-tier then eligible-tier in rotation order and slices to 5. No distinctness check.

Partly mitigated by rotation (see D-1) — which scatters near-duplicates across *different*
slates but does nothing within one.

### P2-7 Rate spread absent

Spec §6.3: try to include one candidate meaningfully below the ceiling and one at the top of
it. Not implemented.

### P2-8 Pool cut happens before filtering, not after

Spec §3 applies hard filters *as a pre-filter in the vector query*. Code takes
`LIMIT 50` by whole-profile cosine ([matching.ts:22](../../src/lib/matching.ts#L22),
[matching.ts:183](../../src/lib/matching.ts#L183)) and filters afterward in JS
([matching.ts:230](../../src/lib/matching.ts#L230)).

With 785 profiles, 735 are never examined. Once real hard filters exist, this ordering
becomes actively wrong: fifty semantically-close candidates could all fail on budget while
the qualified-and-affordable person sits at rank 60. Filter first, then rank.

### P2-9 Snapshot does not freeze embeddings

Spec §6.4: freeze *"the exact profile JSON, embeddings, scores, and modifier values."*
`frozenProfileJson` ([matching.ts:115-155](../../src/lib/matching.ts#L115-L155)) freezes the
profile; `SlateEntry.dims` + `score` freeze the scores. Embeddings are not frozen, so a
re-run against an old snapshot cannot reproduce the original ranking.

---

## P3 — instrumentation

- **P3-1** §8 wants every facet subscore, every modifier, and every elimination reason
  logged per shortlist. Stored today: `SlateEntry.dims` (4 numbers), `score`, `reasons[]`.
  No modifiers exist to log; eliminations are discarded (P1-12).
- **P3-2** §7 "show the facet subscores" to the employer — `dims` is persisted; whether the
  employer dossier actually renders it needs checking in `maskEntry`
  ([slate.ts:62](../../src/lib/slate.ts#L62)) and the employer candidate page. **Verify, do
  not assume.**
- **P3-3** §8 outcome labels: `Connection`, `Interview`, `OutcomeConfirmation`, `Rating`
  cover labels 1, 3, and 4. Label 5 — *"still engaged at 90 days,"* which §8 calls the only
  label that actually matters — has no representation in the schema.

---

## Divergences worth keeping (amend the spec, not the code)

- **D-1 Rotation.** `shortlistCount` / `lastShownAt` ordering
  ([matching.ts:237-244](../../src/lib/matching.ts#L237-L244)) is the *primary* sort key, so
  within a quality tier the slate is fairness-ordered, not score-ordered. The spec's §6
  "do not simply take the top 5 raw scores" gestures at this but the reasoning in the code
  comments is better than anything in the spec. Two thresholds — `QUALIFY_SCORE` for
  eligibility, `MIN_SLATE_SCORE` for tiering — are a genuinely good design the spec doesn't have.
- **D-2 Consent-first matching.** `MatchConsent`, the 48h token, dormancy on non-response,
  admin approval before any candidate is emailed. The spec doesn't model consent at all. The
  code is ahead.
- **D-3 Honest empty slates.** `status = "no_matches"` rather than a padded slate
  ([matching.ts:264](../../src/lib/matching.ts#L264), [matching.ts:279](../../src/lib/matching.ts#L279)),
  with the explicit "never create an empty slate the employer could be charged to unlock."
  This is spec §6.1 implemented more strictly than written.

Also worth noting: `QUALIFY_SCORE = 52` and `QUALIFY_SKILLS = 40` were tuned against the real
pool via `scripts/eval-matching.ts`, with the reasoning recorded in the source comments. Any
rewrite must re-run that harness rather than assume the spec's untuned priors are better —
§8 says as much: *"The weights above are a starting prior, not a result."*

---

## Verify before building

Three things this analysis did not confirm and the plan must not assume:

1. Whether the employer dossier renders `dims` (P3-2).
2. What `scripts/eval-matching.ts` currently measures, and whether it can serve as the
   before/after harness for a scorer rewrite.
3. Whether any migrated legacy profile has `Engagement.span` in a parseable shape, which
   decides whether tenure can be backfilled or only captured going forward.

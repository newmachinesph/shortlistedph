# Canonical tool matching — measured result

Ran the eval against the 785-profile prod pool with `canonicalizeTool` wired into
`matchRequirements`, and diffed against `eval-baseline.md`. Also dumped tool frequency across
the pool. 2026-07-25.

**Result: no change. The alias table was a no-op on these five jobs, and the measurement
disproved the hypothesis it was built on.** This is the baseline earning its keep — it stopped
me shipping the alias table as "the skills-score fix" when it is not.

## The numbers, before vs after

| Job | Baseline max skills | Canonical max skills |
|---|---|---|
| Dental VA | 43 | 43 |
| React engineer | 52 | 52 |
| Bookkeeper | 52 | 52 |
| Amazon PPC | 31 | 31 |
| Support agent | 50 | 50 |

Identical to the digit, every job.

## Why the alias table did nothing here

Canonicalization only helps when the two sides are spelled **differently** — "QBO" on the
profile vs "QuickBooks" in the must-have. It maps both to a shared key so an otherwise-missed
exact match fires.

But it maps *both* sides consistently, so a match that was already exact stays exact — the key
just changes from `quickbooks` to `quickbooks online` on both sides. It changes nothing for
pairs that already matched.

The frequency dump shows the pool writes tools in standard spelling: `quickbooks` (27),
`zendesk` (42), `salesforce` (48), `hubspot` (21) — no `qbo`, no `qb`, no `zen desk` in the
top 80. And the eval's must-haves ("QuickBooks", "Zendesk", "React", "TypeScript",
"PostgreSQL") are already canonical. So there was almost no wording gap to close.

## The real ceiling — proven, not guessed

Every top candidate capped near 52 on skills. That is not an alias miss. It is the
confirmed-weight coverage cap in `scoreSkills`:

```
coverage = earned / (required.length * CONFIRMED_SKILL_WEIGHT)   // CONFIRMED_SKILL_WEIGHT = 2
skills   = min(1, coverage * 0.75 + sim * 0.25) * 100
```

A self-reported ("claimed") match earns weight 1; only a mutual outcome-confirmation earns 2.
So a candidate who genuinely has **all** the must-haves, but none confirmed, tops out at
`coverage = 0.5`. Measured directly:

```
3 must-haves, all matched CLAIMED,   sim 0.5 -> skills 50
3 must-haves, all matched CLAIMED,   sim 0.6 -> skills 53
3 must-haves, all matched CONFIRMED, sim 0.5 -> skills 88
```

**52 is the mathematical ceiling for an unconfirmed profile.** The migrated 785 predate the
outcome-confirmation loop, so almost none have confirmed engagements matching a JD — the whole
pool is pinned under the claimed cap, no matter how many real tools each person has.

Multi-word non-tool must-haves compound it: "Bank reconciliation", "Month-end close", "US
dental practice experience", "Keyword research" never exact-match a tag, so they only ever earn
partial token credit, dragging coverage further below 0.5.

## What this changes in the plan

The alias table is **correct, tested, and safe** — the eval proves zero regression, and its
test suite proves it never merges distinct tools. It stays: it costs nothing and it will earn
its keep the moment wording variance grows (new uploads, employer must-haves written as "QBO").
It is just not the lever the baseline's headline implied.

The actual levers on the skills ceiling, now evidence-backed:

1. **The claimed/confirmed cap (biggest).** An all-claimed perfect match should not be capped
   at 50. Options: raise the claimed contribution, or lift the `* 0.75` blend, or rescale so
   full unconfirmed coverage lands higher with confirmation as the bonus rather than the
   entry price. This is a weighting change — re-tune `QUALIFY`/`MIN` against this eval after.
2. **Multi-word requirement matching.** "Bank reconciliation" should be able to exact-match a
   `bank reconciliation` skill (it currently only token-matches). Canonicalize multi-word
   skills too, or add a phrase-level exact pass.
3. **The `functions` facet (spec §4 facet 2).** The pool stores soft-skill noise —
   "communication" (153), "attention to detail" (69), "time management" (131) — as Skill rows.
   A dedicated functions field would separate "what I can own" from tag soup.

Do **not** tune `QUALIFY_SCORE` down to manufacture fuller slates — the thin results are the
cap talking, and lowering the bar would pad slates with genuinely weak matches.

## Frequency dump highlights (top of 785-profile pool)

Dominated by soft skills, not tools: customer service (213), communication (153), data entry
(145), time management (131), problem solving (106), attention to detail (69). Real tools
present as canonicals: microsoft office, google workspace, canva, salesforce, slack, zendesk,
javascript, python, mysql, quickbooks, hubspot, wordpress, zoom, git.

Note: `scripts/tool-frequency.ts` undercounts coverage — its "known" flag only catches
aliases, not canonicals that map to themselves, so `salesforce`/`zendesk`/etc. show as
unmapped when the table does know them. Fix the flag before trusting its coverage percentage.

---

# Follow-up: the coverage-denominator rework (the actual fix)

Acting on the diagnosis above, changed the one lever that was the real ceiling:
`scoreSkills` divided coverage by `required.length * CONFIRMED_SKILL_WEIGHT` (2), capping a
fully-claimed match at coverage 0.5 → skills ~50. Introduced `SKILL_COVERAGE_DENOM = 1.5` as
the denominator instead. A fully-claimed match now reaches ~63; a fully-confirmed one still
caps at 100. Confirmation is the bonus, not the entry price.

Measured against the same five jobs on the same 785-profile prod pool:

| Job | Baseline qualify / strong · maxSkills | After · maxSkills |
|---|---|---|
| Medical VA (dental) | 1 / 1 · 43 | **6 / 5 · 53** |
| Senior React | 5 / — · 52 | **23 / 18 · 65** |
| Bookkeeper | 3 / 2 · 52 | **13 / 11 · 64** |
| Amazon PPC | 0 · 31 | **0 · 37** |
| Customer support | 1 / 1 · 50 | **8 / 4 · 62** |

Four of five jobs now fill a slate of 5, where four of five previously could not. Amazon PPC
still returns nothing — its maxSkills (37) stays under the `QUALIFY_SKILLS` 40 gate, so the
niche-not-in-pool precision (spec §9) is preserved. This was not a blanket loosening of the
bar; it was correcting a denominator that punished the whole migrated pool for predating the
confirmation loop.

**Not yet done, and deliberately:** `QUALIFY_SCORE`/`MIN_SLATE_SCORE` were tuned against the
old coverage math and have not been re-tuned to the new distribution. The slates fill sensibly
at the current thresholds, but a proper calibration pass (spec §8) against these outputs is the
next step before this ships. The change is committed on the branch, not merged — the eval
evidence is the review artifact.

---

# Follow-up 2: threshold recalibration (2026-07-25, closes the loop)

Ran the eval read-only against the 785-profile prod pool (`EVAL_DB=prod`, added to the
script) and re-tuned the composite thresholds to the post-rework distribution.

The measured shift at the 0.45 skills weight: a fully-claimed full match gained ~13 skills
points (ceiling 52 → 65) = +6 composite; a mid-coverage partial gained ~7 = +3 composite.
Applied exactly that shift:

| Constant | Old | New | Why |
|---|---|---|---|
| `MIN_SLATE_SCORE` | 62 | **68** | old 62 + the +6 full-match shift |
| `QUALIFY_SCORE` | 52 | **55** | old 52 + the +3 partial-match shift |
| `QUALIFY_SKILLS` | 40 | **40 (unchanged)** | distribution is bimodal around it: eligible ≥ 43, gated rejects ≤ 37 (PPC max 37). Still separates cleanly |

Measured effect on the five jobs (same pool, before → after recalibration):

| Job | eligible | strong (≥62 → ≥68) | slate |
|---|---|---|---|
| Medical VA | 6 → 6 | 5 → 2 | full |
| Senior React | 23 → 23 | 18 → 10 | full |
| Bookkeeper | 12 → 12 | 11 → 5 | full |
| Amazon PPC | 0 → 0 | — | empty (precision preserved) |
| Customer support | 10 → 9 | 6 → 3 | full |

One candidate lost eligibility (support, 54 composite / 46 skills) — a weaker partial than
anything the pre-rework bar ever admitted. "Strong" regained its meaning: it was covering
two-thirds of the eligible set on React; now it marks the genuine top tier and the
QUALIFY..MIN band backfills, which is exactly the tiering `buildSlate` was written for.

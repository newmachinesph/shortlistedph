# Eval baseline — scorer before any Phase 1c/3 change

Captured 2026-07-25 by running the real scorers (`scripts/eval-matching.ts` logic) against
the **prod** pool of 785 embedded profiles, read-only. This is the before-picture. Any
scorer change re-runs the same five jobs and diffs against these numbers — the point of §8's
"the weights are a prior, not a result."

Reproduce: point `scripts/eval-matching.ts` at `PROD_DATABASE_URL` (its default `.env.local`
override loads the 2-profile dev DB, which tells you nothing). Costs 5 embedding calls.

## Raw run

```
Pool: 785 embedded profiles

=== Medical VA for a US dental group   ($8-11/hr · US dental, insurance verif, scheduling)
    1 qualify (>=52), of which 5 strong (>=62); 49 below
  1.  64  Registered Pharmacist | Healthcare Virtual Assistant   $10/hr 3y  [sk 43 rt 100 ov 100 ex 48] sim 0.462

=== Senior React engineer   ($18-28/hr · React, TypeScript, PostgreSQL)
    5 qualify (>=52), of which 11 strong (>=62); 40 below
  1.  70  Senior Full Stack Engineer         $13/hr 6y  [sk 51 rt 80  ov 100 ex 80] sim 0.547
  2.  70  Software Engineer | Full-stack     $10/hr 8y  [sk 50 rt 80  ov 100 ex 80] sim 0.498
  3.  66  Senior Software Engineer           $?/hr  7y  [sk 51 rt 60  ov 100 ex 80] sim 0.545
  4.  66  Senior Frontend Engineer           $?/hr  8y  [sk 52 rt 60  ov 100 ex 80] sim 0.582
  5.  66  Senior Software Engineer           $?/hr  8y  [sk 50 rt 60  ov 100 ex 80] sim 0.502

=== Bookkeeper for US small businesses   ($8-13/hr · QuickBooks, bank rec, month-end close)
    3 qualify (>=52), of which 11 strong (>=62); 47 below
  1.  68  Accountant/Bookkeeper              $10/hr 4y  [sk 44 rt 100 ov 100 ex 64] sim 0.530
  2.  65  Senior Accountant                  $10/hr 3y  [sk 46 rt 100 ov 100 ex 48] sim 0.577
  3.  61  CPA | 5 years of bookkeeping       $15/hr 5y  [sk 52 rt 35  ov 100 ex 80] sim 0.566

=== Amazon PPC specialist   ($10-16/hr · Amazon PPC, Helium 10, keyword research)
    NO QUALIFIED CANDIDATES - 50 below QUALIFY 52 (top was 59)

=== Customer support agent for a US SaaS   ($8-12/hr · Zendesk, live chat, refunds)
    1 qualify (>=52), of which 10 strong (>=62); 49 below
  1.  67  Customer Service Professional      $10/hr 3y  [sk 50 rt 100 ov 100 ex 48] sim 0.503
```

## What the numbers say — and which gap-analysis item each confirms

### Skills subscores are the ceiling on everything (P1-1, P2-3)

**No candidate, on any job, scored above 52 on skills.** Top React engineers: 50-52. Top
bookkeeper: 44. The dental VA that "qualified": 43. Skills carries `WEIGHTS.skills = 0.45`,
so a skills score stuck near 50 caps the composite near 65 no matter how good the person is.

This is exactly the canonical-tool-ID gap. `scoreSkills` needs an exact `normalizedName`
match on the must-have, and the prefix stemmer cannot connect "QuickBooks" to "QBO" or
"QuickBooks Online", so most credit comes from the 0.25-weighted embedding term. The pool
almost certainly contains genuine QuickBooks bookkeepers scoring 44 on QuickBooks. **This is
the single biggest quality lever, and it is P1-1 + P2-3.** Expect the alias table alone to
move these 44-52s into the 70-90 range.

### Rate ranks, it does not filter (P0-1) — visible and wrong

The React slate's top two are **$13/hr and $10/hr against an $18-28 budget**. They score
rt 80 (well under budget reads as good) and rank #1 and #2. Meanwhile three candidates with
**no rate set at all** (`$?/hr`) score rt 60 and still qualify — a null rate is being scored,
not filtered.

Under the ceiling this is arguably fine (cheaper is better), but it shows rate is a
similarity dimension: it participates in the ranking rather than gating it. The bookkeeper
CPA at $15/hr scores rt 35 and drops to #3 despite the **highest skills score in that job
(52)** — a qualified person demoted by rate math, which §3 says should never happen because
rate is a filter, not a score. This is P0-1 in the wild.

### "Overlap" is pinned at 100 everywhere (P2-2)

Every single ranked candidate scored ov 100. Because it is `40 - committedHours` vs
`hoursPerWeek` and most profiles have `committedHours = 0`, the dimension saturates and
carries no signal at all. It is dead weight at 0.15 of the composite, and — until the
relabel this session — it was shown to employers as "Timezone". Real timezone overlap (P1-5,
P2-2) would actually vary.

### Precision is holding where it should (D-3, cold-start §9)

Amazon PPC returned **zero qualified**, top score 59. That is the system correctly saying the
niche is not in the pool rather than padding a slate with wrong-domain people — spec §9's
"prefer 3 excellent over 5 padded" working as designed. Good. Do not tune QUALIFY down to
manufacture a slate here.

### A reporting bug in the eval harness itself (not production)

"1 qualify, of which 5 strong" is impossible — you cannot have more strong candidates than
qualified ones. `scripts/eval-matching.ts` computes `strong` over all 50 pooled candidates
but `qualified` over the QUALIFY **and** `skills >= QUALIFY_SKILLS` gate. Production's
`buildSlate` derives `strong` from the eligible set, so the two diverge only in the eval
script's console line. Cosmetic, but fix it before using the harness for a before/after diff
or the "strong" column will mislead. **Does not affect any ranking.**

## Thresholds, for the diff later

- `QUALIFY_SCORE = 52`, `QUALIFY_SKILLS = 40`, `MIN_SLATE_SCORE = 62`, `WEIGHTS
  {skills .45, experience .20, rate .20, overlap .15}`, `VERIFIED_BONUS = 4`.
- Removing rate from the composite (1c) invalidates all three thresholds — they were tuned
  with rate in. Re-tune against this pool, do not carry the numbers across.

## Headline number to beat

Across five realistic jobs, **11 total candidates cleared QUALIFY, and only one job filled a
slate of 5.** Three jobs returned a single qualifier; one returned none. On an 785-profile
pool that should comfortably fill dental-VA, bookkeeper, and support slates, that is the
skills-scoring ceiling talking, not a thin pool. The canonical tool table (P1-1) is the fix
this baseline most loudly asks for.

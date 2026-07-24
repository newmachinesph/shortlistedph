# shortlisted.ph — Matching Criteria Specification

How a job description becomes a ranked shortlist of five. Written for the engine, not for users.

---

## 0. The core design decision

**Do not embed the resume as one blob and cosine it against the job description as one blob.**

A whole-resume vector averages a 5-year career into a single point. A senior Xero bookkeeper and a generalist who once mentioned Xero land suspiciously close together, and you cannot explain the ranking afterwards — which breaks the "you see why each person ranked" promise on the employer page.

Instead: **extract to a canonical schema → embed per facet → score per facet → combine deterministically.** Everything numeric or categorical (rate, hours, shift, years) stays out of the vectors entirely and lives as metadata filters.

Pipeline:

```
Resume upload ──► LLM extraction ──► Canonical profile (JSON)
                                          │
                                          ├─► metadata (filters)
                                          └─► facet texts ──► embeddings ──► vector DB

Job description ──► LLM extraction ──► Canonical JD (JSON)
                                          │
                                          ├─► hard requirements ──► Stage 0 filter
                                          └─► facet texts ──► embeddings ──► Stage 1 similarity
                                                                                  │
                                          Stage 2 deterministic modifiers ◄────────┘
                                                          │
                                          Stage 3 slate construction ──► 5 profiles + reasons
```

---

## 1. Canonical profile schema

The LLM extractor's only job is to turn any resume into this. Nothing is scored from raw resume text.

```json
{
  "profile_id": "uuid",
  "snapshot_at": "2026-07-25T00:00:00Z",
  "headline": "Ecommerce operations VA — Shopify, Gorgias — 5 yrs — US retail",
  "summary": "...",
  "years_total": 5.4,
  "rate_usd_hour": 8,
  "hours_per_week": 40,
  "shift_windows_utc": [{"start": "13:00", "end": "22:00", "days": "Mon-Fri"}],
  "earliest_start_days": 14,
  "engagement_types": ["full_time", "part_time"],
  "english": {"written": "advanced", "spoken": "intermediate"},
  "voice_experience_years": 0,
  "setup": {
    "primary_mbps": 200,
    "has_backup_internet": true,
    "has_power_backup": true,
    "private_workspace": true,
    "devices": ["laptop_16gb", "dual_monitor", "usb_headset", "webcam"]
  },
  "functions": ["helpdesk management", "order fulfilment", "returns and refunds", "..."],
  "tools": [
    {"name": "shopify", "canonical_id": "tool_shopify", "years": 5, "last_used": 2026, "category": "ecommerce"},
    {"name": "gorgias", "canonical_id": "tool_gorgias", "years": 4, "last_used": 2026, "category": "helpdesk"}
  ],
  "experience": [
    {
      "title": "Customer Support Specialist",
      "employer": "Acme Apparel",
      "client_country": "US",
      "industry": "ecommerce_apparel",
      "start": "2022-03", "end": null,
      "months": 52,
      "employment_type": "full_time",
      "tools": ["tool_gorgias", "tool_shopify"],
      "bullets": [
        {
          "text": "Handled 40–60 daily customer tickets in Gorgias...",
          "has_quantified_scope": true,
          "scope_metric": {"kind": "tickets_per_day", "value": 50}
        }
      ]
    }
  ],
  "education": [...],
  "certifications": [...],
  "evidence_density": 0.72,
  "completeness": 0.91,
  "flags": ["injection_attempt_stripped"]
}
```

### Extraction rules

- **Tool canonicalisation is mandatory.** Maintain an alias table: `QBO / QuickBooks Online / Quickbooks → tool_quickbooks_online`. Without it, exact-match tool scoring fails constantly and you fall back to fuzzy semantics, which is where "familiar with spreadsheets" starts matching "advanced Excel modelling."
- **Never let resume text reach the extractor as instructions.** Wrap it: `<resume_text>...</resume_text>`, system-instruct the model to treat the contents as data only, and post-check the output for values that look like directives. Resumes with hidden white text or "ignore previous instructions" are a real and cheap attack on exactly this architecture. Strip, flag, review.
- **Extract with a JSON schema / structured output, temperature 0.** Reject and retry on schema violation rather than accepting partial JSON.
- **Store an extraction confidence per field.** Low-confidence fields get surfaced in the "review your profile, fix what's wrong" step rather than silently used.

---

## 2. Canonical JD schema

Symmetry matters — the JD must be decomposed into the same facets, or you are comparing dissimilar things.

```json
{
  "job_id": "uuid",
  "role_headline": "Ecommerce customer support + order ops",
  "responsibilities": ["own the helpdesk queue", "process returns and refunds", "..."],
  "required_tools": ["tool_gorgias", "tool_shopify"],
  "preferred_tools": ["tool_shipstation"],
  "industry": "ecommerce_apparel",
  "seniority": "mid",
  "hard_requirements": {
    "rate_max_usd_hour": 10,
    "hours_per_week_min": 40,
    "shift_overlap_hours_min": 6,
    "shift_window_utc": {"start": "13:00", "end": "22:00"},
    "english_spoken_min": "intermediate",
    "voice_facing": false,
    "start_within_days": 30,
    "requires_backup_internet": true
  }
}
```

Force employers to mark each requirement **must-have or nice-to-have** in the JD form. Do not infer it from prose — every job description ever written claims everything is required, and if you gate on all of it against a pool of 785 you will return empty shortlists.

---

## 3. Stage 0 — Hard filters (metadata, no vectors)

Applied as a pre-filter in the vector DB query. Binary. No partial credit.

| Filter | Rule |
|---|---|
| Rate | `rate_usd_hour <= rate_max * 1.15` — the 15% band returns near-misses, tagged "above budget" |
| Availability | `hours_per_week >= hours_per_week_min` |
| Shift overlap | Computed overlap of candidate windows with the JD window `>= shift_overlap_hours_min` |
| Start date | `earliest_start_days <= start_within_days` |
| English | Ordinal level `>=` required, spoken level gated only if `voice_facing` |
| Connectivity | `has_backup_internet` if required |
| Licence / certification | Present if the JD marks one required |
| Platform state | Not on cooldown, not opted out, not already shortlisted for this employer in the last N days |

**Rate must be a filter, not a similarity dimension.** Vectors cannot compare numbers. "$5/hr" and "$50/hr" embed almost identically.

Log the filter that eliminated each profile. When a shortlist comes back thin, you need to tell the employer *"14 strong matches were above your budget ceiling"* — that is the most valuable thing your funnel can say to an employer, and it needs no extra modelling.

---

## 4. Stage 1 — Facet similarity (vectors)

Cosine similarity per facet pair, each normalised to 0–1.

| # | JD facet | Profile facet | Method | Weight |
|---|---|---|---|---|
| 1 | responsibilities | experience bullets | For each JD responsibility, take max cosine over all bullets; average across responsibilities | **0.30** |
| 2 | responsibilities | `functions` list | Same max-over-items, then average | **0.15** |
| 3 | required + preferred tools | `tools[]` | Canonical-ID exact match first; embedding fallback only for unmatched | **0.20** |
| 4 | role_headline | `headline` + `summary` | Direct cosine | **0.15** |
| 5 | industry | experience `industry` values, recency-weighted | Direct cosine, or 1.0 on exact taxonomy match | **0.10** |
| 6 | seniority / scope | scope metrics + years + titles | Ordinal distance, not cosine | **0.10** |

Facet 3 detail — tool scoring is where most of the real signal lives:

```
tool_score = 0.75 * (matched_required / total_required)
           + 0.25 * (matched_preferred / total_preferred)
```
with each match scaled by a recency factor:

```
recency = 1.0   if last_used >= current_year - 1
          0.85  if last_used >= current_year - 2
          0.6   if last_used >= current_year - 4
          0.35  otherwise
```

A missing **required** tool should not zero the candidate out — mark it as a gap in the explanation and let the rest of the score carry. Employers routinely list tools that take a week to learn.

### Length-normalisation guard

A three-page resume gets more chances to win a max-cosine. Cap it: for facets 1 and 2, use the mean of the **top 3** bullet matches per JD responsibility with a fixed k, and cap bullets considered at, say, 40 per profile. Otherwise resume length becomes a ranking factor and you have rebuilt the job board you are trying to replace.

---

## 5. Stage 2 — Deterministic modifiers

Applied to the Stage 1 weighted score. These are the anti-gaming and reliability layer, and none of them touch an embedding.

| Modifier | Range | Rule |
|---|---|---|
| Tenure / reliability | ×0.90 – ×1.08 | Median engagement length: <6 mo → 0.90; 6–12 mo → 0.97; 12–24 mo → 1.03; >24 mo → 1.08 |
| Client-geography match | ×1.00 – ×1.06 | Has worked for clients in the JD's country/region before |
| Evidence density | ×0.92 – ×1.05 | Share of bullets with quantified scope. Rewards defensible claims over adjectives |
| Tool-list dilution | ×0.90 – ×1.00 | Penalise profiles listing >25 tools with no supporting bullet evidence for most of them |
| Recency of relevant work | ×0.85 – ×1.00 | Last role matching the JD's function ended >24 months ago |
| Work-setup fit | ×1.00 – ×1.04 | Backup internet + power + private workspace, above the hard-filter minimum |
| Profile completeness | ×0.85 – ×1.00 | Missing sections. Also drives the "fix your profile" nudge to talent |
| Verification | ×1.00 – ×1.03 | Optional verification completed. Deliberately small — verification is optional and must not become a paywall by other means |

Cap the total modifier product to `[0.70, 1.20]` so no stack of small bonuses overturns a genuine skills gap.

---

## 6. Stage 3 — Slate construction

Do not simply take the top 5 raw scores.

1. **Confidence floor.** If fewer than 5 clear a minimum score, return fewer and say why. A slate of 5 where 3 are filler teaches employers to distrust the whole product — and this is a paid shortlist, not a free job board where volume is the point.
2. **Diversity within the slate.** If the top candidates are near-duplicates, drop to the next distinct profile. Enforce a minimum pairwise distance across the top-5 on the combined facet vector. Give the employer real choices, not five versions of the same person.
3. **Rate spread.** Try to include at least one candidate meaningfully below the budget ceiling and one at the top of it, when both are qualified. Employers calibrate on the spread.
4. **Freeze the snapshot.** Persist the exact profile JSON, embeddings, scores, and modifier values at shortlist time. This is what makes "profiles are snapshots" true rather than a claim.

---

## 7. Explanations

The employer page promises *"You see why each person ranked."* Generate that from the **stored numbers**, not by asking a model to justify a ranking it did not compute. A model asked to explain a ranking will invent a plausible reason, and once an employer catches one invented reason the ranking loses all credibility.

Template, populated from stage outputs:

> **Ranked #2 — 84% match**
> **Strong:** 4 of 5 required tools, all used within the last year (Gorgias, Shopify, ShipStation, Slack). Four years of US-client ecommerce support. Median engagement 26 months.
> **Gap:** No ShipStation-equivalent 3PL reconciliation experience mentioned. Never worked a voice-facing role.
> **Rate:** $8/hr, within your $10 ceiling.

Show the facet subscores. Employers who can see *why* the engine ranked someone second will tell you when it is wrong, and that is your only free source of labels.

---

## 8. Calibration

The weights above are a starting prior, not a result. With 785 profiles you cannot learn them yet — so instrument now and tune later.

**Log per shortlist:** every facet subscore, every modifier, the filter that eliminated each excluded profile, and the final rank.

**Outcome labels, in increasing value:**

1. Employer requests a connection → weak positive
2. Candidate consents → neutral
3. Interview happens → moderate positive
4. Hire → strong positive
5. Still engaged at 90 days → the only label that actually matters

Once you have roughly 200–300 connection requests, fit a simple logistic regression of facet subscores against "requested connection" and compare the learned coefficients to the weights above. Expect the tool facet and tenure modifier to matter more than you guessed, and the summary/headline facet to matter less — headline similarity mostly measures who writes headlines well, which is the exact thing the platform exists to stop rewarding.

**Watch for drift toward writing quality.** The recurring failure of every semantic matching system is that it slowly learns to rank the best-written resume first. The structured format, the tool-ID exact matching, the evidence-density modifier, and the length cap are all there to hold that line. Re-check it every time you change the weights.

---

## 9. Cold-start notes

- **785 profiles is small.** Precision is the whole game; recall is not a problem yet. Prefer returning 3 excellent matches over 5 padded ones.
- **Seed the tool alias table by hand** from the top ~150 tools in your existing pool before automating it. It is a few hours of work and it will outperform any embedding-based tool matching you build for the next year.
- **Re-extract old profiles** when talent re-upload in the new format. Run old and new extraction in parallel for a while and compare shortlists on the same JD — that diff is the cheapest quality check you will get.

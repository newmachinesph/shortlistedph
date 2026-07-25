# System audit — 2026-07-26 (ROUND 1)

> **STATUS: addressed in commit `32e8fce`.** Every P0–P5 item below was worked in
> the round-1 rebuild. This document is now the RECORD OF WHAT WAS WRONG, not a
> to-do list — do not read a heading here as a live defect without checking the
> code. Round 2 re-audits the result adversarially; see `docs/system-audit-2.md`
> for what actually survived and what the rebuild broke.


Full-system review by five parallel deep audits (employer, talent, interviewer+admin,
affiliate, engine/infra), every claim cited to file:line at audit time. This is the
roadmap source of truth: fix P0 before loading profiles back in, P1 before opening
signups, the rest in order.

## What the system is (one loop per actor)

- **Employer**: signup → brief (LLM-drafted JD) → publish → engine builds a consent-first
  slate → admin approves → candidates accept in → employer buys credits (PayPal) →
  unlocks slate → connection → agreement → monthly outcome confirms → ratings.
- **Talent/jobseeker**: signup → resume upload/parse (injection-guarded) → gap wizard →
  publish (= consent + embed) → appears in pools → consent emails → frozen snapshot on
  accept → connection/agreement → confirmed skills → interviews.
- **Interviewer**: apply → admin approves (role flip) → assigned paid interviews →
  schedule → record → assessment → payout batches.
- **Affiliate**: referral link → cookie attribution → conversion on signup → $9 recurring
  commission per shortlist-credit purchase → payout request → admin settlement.
- **Admin**: slate review/approve/rematch, users/reports, openings board control,
  interviewer + affiliate settlement, settings flags, audit log.

The load-bearing invariants: **snapshot is the product** (frozen at consent, employers
never see live profiles), **consent-first** (nobody appears on a slate without accepting),
**credits are the money** (PayPal purchase → credit balance → unlock/interview spend).

---

## P0 — money & core-promise breaks (fix before reloading profiles)

1. **Refunds claw nothing back.** `markPaymentRefunded` (`src/lib/fulfillment.ts:184-186`)
   flips `Payment.status` only. Credits, interview credits, `Entitlement` rows, and the
   $9 referral commission all survive a full PayPal refund
   (`src/app/api/paypal/webhook/route.ts:77-80`). Fix: refund handler reverses unspent
   credits, voids the commission for that `paymentId`, flags for admin when already spent.

2. **Commission silently lost when the receipt email throws.** In `fulfillPurchase`,
   `mail.paymentReceipt` (`src/lib/fulfillment.ts:146`) runs before `recordCommission`
   (`:165`) inside one swallowed try/catch (`:169-171`); payment idempotency means it is
   never retried. Fix: move `recordCommission` above the mail or isolate its try.

3. **Identity verification takes money for a feature that cannot complete.**
   `verifiedTier` has **no writer** anywhere. Fulfillment defers to "the Didit webhook"
   (`src/lib/fulfillment.ts:84-93`) — no such route exists. Retry blocked forever by
   "Verification already paid for" (`src/app/api/paymongo/checkout/route.ts:22-25`).
   Paid, unverifiable, unrefundable. Fix: build the webhook or pull the product from sale.

4. **Anti-tailoring hole: the snapshot freezes AFTER the candidate sees the must-haves.**
   Schema promises "profile as it existed when the JD was published"
   (`prisma/schema.prisma` ProfileSnapshot comment); actual freeze is at consent-accept
   (`src/lib/consent.ts:213-226`) — after the consent page/email showed title, budget,
   hours, and `mustHaves` (`src/app/consent/[token]/page.tsx:66-86`). 48h window to
   tailor, then accept. `profileStableDays` clamps to 0 but the tailored content is
   frozen and shown. Fix: snapshot at invite time (buildSlate), not accept time.

5. **Slate can overfill and mis-route.** `respondToConsent` appends unconditionally
   (`src/lib/consent.ts:236-245`) while the cron invites up to `SLATE_SIZE*3`
   (`src/lib/consent.ts:19`) — a 5-person slate can reach 15. And consents bind to
   `jdId`, not a slate: accepts land on whichever slate is newest-approved
   (`src/lib/consent.ts:166-170`) — including one the employer already paid to unlock,
   while `buildSlate` creates a new slate every run (`src/lib/matching.ts:325`).
   Fix: cap accepts at SLATE_SIZE, bind consent rows to a slate id.

6. **Interview credits: spent but never ledgered; refunds impossible.**
   `confirmInterview` decrements the counter (`src/lib/interviews.ts:145`) but no
   `Entitlement` is marked spent (asymmetric with slate unlock,
   `src/app/api/slates/[id]/unlock/route.ts:43-52`). A `paid` interview whose
   interviewer goes dark has no refund, no admin cancel, no timeout — admin cannot
   mutate an Interview at all. Admin credit deductions orphan entitlements
   (`src/lib/admin.ts:393`). No sold-vs-spent-vs-delivered reconciliation exists.

7. **Publish success screen is broken.** `brief-builder.tsx:41,97,127` renders
   `result.entries` — `buildSlate` returns `{slateId, scanned, invited}`
   (`src/lib/matching.ts:338`). Renders "ranked  for your shortlist" with a hole, and
   overpromises: the slate is empty and behind admin review at that moment.

8. **Interviewer approval destroys the person's other role.** Approve flips
   `User.role="interviewer"` unconditionally (`src/app/api/admin/interviewers/[id]/route.ts:34`);
   any signed-in user can apply. A talent-turned-interviewer can no longer consent to
   interviews of themself (403 at `requireRole("talent")`) while their profile stays in
   the matching pool; an employer loses every employer route with credits stranded.
   `requirePageUser` (`src/lib/queries.ts:12-20`) doesn't handle `interviewer` →
   redirect loop on /talent/*. No admin lever reverses a role, ever
   (`src/app/api/admin/users/[id]/route.ts:6-19` has no role field).

## P1 — dead or unreachable subsystems

9. **`MatchElimination` is write-only** (written `src/lib/matching.ts:289-298`, zero
   readers). The employer `no_matches` screen hand-waves while per-reason data sits in
   the DB. The cron re-rank also discards eliminations
   (`src/app/api/cron/consent-refresh/route.ts:112`), and `aboveBudget` from
   `filters.ts:78` is thrown away at `matching.ts:209`.

10. **`hard_filters_enabled` cannot be flipped.** Load-bearing at `matching.ts:207`;
    missing from the admin settings PATCH enum (`src/app/api/admin/settings/route.ts:14`)
    and the settings page. Stage 0 is unreachable without a manual `AppSetting` insert.
    Similarly `JobDescription.hardRequirements` has **no writer** — every JD uses the
    derived fallback; `startWithinDays` is dead shape.

11. **`ProfileTool` has no runtime writer.** Only the (now-superseded) backfill script
    wrote it; profile save and resume parse create `Skill` rows only. **The fresh DB
    starts with it empty — wire ProfileTool writes into profile save/parse before or
    when profiles are reloaded**, or Phase 3 starts on stale/no data. JD side is wired
    (`api/jds/route.ts:67-68`) but `requiredTools`/`preferredTools` have no reader yet
    (expected until Phase 3).

12. **JD lifecycle half-missing.** No JD edit or delete API; "Continue editing" links to
    `/employer/briefs/new` which creates a new row (`src/app/employer/page.tsx:120-127`);
    `closed` is unreachable (so public openings show "matching now" forever,
    `src/lib/openings-shape.ts:58`); `failed` has no UI branch on the detail page;
    `matching` is an employer dead end only admin can rescue. `screeningQuestions`,
    `initialInstructions`, `schedulingUrl` are accepted by the API, sent by no UI, read
    by nothing.

13. **Talent has no post-onboarding edit surface.** Profile page is read-only; the wizard
    only shows unresolved gaps. Summary/city/education/links become uneditable once
    filled. `visibility` — the matching gate AND photo-consent gate — has no UI toggle.
    No in-app view of pending `MatchConsent` (email-only; miss one → dormancy strike).
    Dormancy clears only via workspace login (`src/app/talent/layout.tsx:21-26`) —
    migrated no-password users have no email-reachable exit.

14. **Admin lacks the levers its subsystems need.** No dormancy clear, no `flags` clear
    (injection review has no workflow, no filter, no counter), no rate-lock override
    (typo'd rate = 30 days locked), no interview mutation, no assessment visibility
    (admin pays interviewers without seeing their output), no `/admin/openings` index
    (list-publicly form only renders inside slate review, so a JD without a slate can
    never be listed and live listings can't be audited).

## P2 — engine correctness drift

15. **Eval harness ranks a different pipeline than production.**
    `scripts/eval-matching.ts` filters only `embedding IS NOT NULL` (prod adds
    published/visibility/dormant/status gates), omits the verified bonus (up to 4 pts),
    hardcodes LIMIT 50 separately from `CANDIDATE_POOL`, reimplements scoring instead of
    importing `rankQualifiedForJd`, and skips rotation. **Current thresholds
    (68/55/40) were calibrated on this divergent pipeline.** Fix: make the harness import
    the production ranking path, then re-check calibration.

16. **Consent re-score ≠ ranking score.** Ranking embeds a fresh JD query vector
    (`matching.ts:189-191`); consent-accept compares against stored `j.embedding`
    (`consent.ts:180-182`) — different vectors per facet slot. The score frozen into
    `SlateEntry` is not the score that qualified the candidate.

17. **Embedding drift, remaining holes.** Resume re-upload on a published profile
    rewrites headline/summary/skills and **never re-embeds**
    (`api/talent/resume/parse/route.ts:59-91`). Outcome confirmation flips
    `Skill.confirmed` — which the skills facet text embeds — with no re-embed
    (`src/lib/agreements.ts:145-167`). JD side has no re-embed path at all post-publish.
    PATCH re-embed failures are swallowed with no retry (`talent/profile/route.ts:134-136`).

18. **Small engine inconsistencies.** Skill confirmation matches raw `name` while
    everything else uses `normalizedName` (`agreements.ts:164`); "free hours" computed
    as two separate literals (`filters.ts:43-45`, `scoring.ts:202`); parsed
    `hoursPerWeek` preference is dropped so `committedHours` silently stays 0 — which
    feeds both `scoreOverlap` and the `hours_short` hard filter; engagement `highlights`
    parsed then dropped though the facet builder reads them from DB rows;
    `availability` has two writers and only one stamps `availabilityConfirmedAt`
    (wizard uses the wrong one → fresh publishes get an immediate staleness nudge).

## P3 — copy sells what code doesn't do

19. Pricing page: "free re-slate if fewer than 3 consent" (×3 places) — no implementing
    code. "Hiring desk $249/mo" — no product, no code. "Candidates see your
    response-rate score" — consent view deliberately excludes employer identity; ratings
    have no read side except the employer's own page.
20. Interviews: "you can pay once they agree — nothing is charged until then" — money
    moved at credit purchase; confirm only decrements. Status name `paid` is stale
    (`paymentRef` never written).
21. `prospectCount` and public stats overstate the matchable pool (omit
    dormant/embedding gates, ignore the `hoursPerWeek` they accept), then matching adds
    qualify gates on top.
22. Referral payout: ₱500 minimum is copy-only (`requestPayout` accepts any non-zero)
    and mis-denominated (commissions are USD); legacy `gcash|bank` methods bypass the
    `PAYOUT_METHODS=["paypal"]` validation; mixed-currency balances dead-end with no
    admin lever; no un-void; voided-conversion uniqueness permanently bars the company.
23. Talent copy: "committed hours update automatically when agreements start" — nothing
    writes it. "Locks for 30 days once published" — locks on save, pre-publish too.
    "I'm open to new offers" reads as a switch but never filters the pool. Expired-consent
    page promises a "switch" that is an invisible login side effect.

## P4 — silent flows & missing connective tissue

24. **The slate fills in silence.** Consent accept/decline notifies nobody — employer is
    told once at approval, then must reload. No employer welcome email
    (`welcomeTalent` only). Connection accepted/declined, agreement signed, outcome
    confirmed, interview consented/recorded — in-app notify only, zero emails.
25. **Referral silence.** No email/notification on commission accrual (the whole
    recurring pitch), none on payout rejection (balance silently reappears), no admin
    alert on payout request. `referral_signup` notify type is dead; two links point at a
    redirect stub (`/talent/payouts`).
26. **Interview produces no durable signal.** Assessment (technical/communication/
    English) writes back to nothing — not `englishLevel`, not `Skill.confirmed`, not
    rotation. Interviewers are rated by nobody; roster shows a raw count. Placed,
    working candidates keep rotating into new slates at full priority.
27. **Referrals invisible to interviewers** (no nav entry, `/referrals` bounces them);
    no public affiliate page — the only entry is in-app nav.
28. **Deletion cascades destroy money history.** Deleting a referred user cascades
    conversions → commissions, including ones inside a *paid* payout; earned drops below
    paid with no audit trace. Consider `onDelete: Restrict` on money rows.

## P5 — hygiene

29. **No rate limiting anywhere.** LLM endpoints (`/api/jds/draft` 20k chars,
    `/api/talent/resume/parse`), embedding writers (profile PATCH fires 4 embeddings per
    save, no debounce), unauthenticated `/api/start` and consent token endpoint.
30. **Untested money/security paths.** Nothing imports `fulfillment.ts`, `payments.ts`,
    `session.ts`, `consent.ts`, `matching.ts`, `admin.ts`, or either webhook.
    `facets.ts`/`matching.ts` COALESCE fallbacks untested. (Loadout rule: test what
    breaks silently — these are exactly that list.)
31. **Admin gate style inconsistent** (five pages rely on layout only, four re-guard);
    `GET /api/admin/settings` returns one key while PATCH accepts three; `USER_ROLES`
    implies role-as-permission while the real gate is the env allowlist.
32. **Scripts superseded by the baseline migration** (`prisma/migrations/20260726000000_init/`):
    all seven `add-*.sql`/`verify-*.sql`, `migrate-profiles.ts`, `migrate-avatars.ts`,
    `embed-profiles.ts`, `backfill-profile-tools.ts` (re-run this one after profiles
    reload). Keep `db-run.ts` for ad-hoc SQL, `db-hardening.sql` retired into the
    migration. **Future schema changes: `npx prisma migrate dev --create-only`, edit the
    generated SQL if it touches vector columns, never `prisma db push`.**

---

## Recommended order of attack

1. **P0 items 1–3** (refund clawback, commission ordering, verification webhook-or-pull) —
   money correctness, small diffs.
2. **P0 item 8 + requirePageUser** — role model, blocks interviewer program.
3. **P0 items 4–5** (snapshot timing, slate binding/cap) — core product promise; do
   before reloading profiles so snapshots are born correct.
4. **P1 items 11–13** (ProfileTool runtime writes, JD edit/close, talent edit surface) —
   needed for the reloaded pool to stay coherent.
5. **P2 15–17** (eval harness parity, consent re-score, re-embed holes) — then
   re-calibrate thresholds once real profiles are back.
6. P1 9–10 (surface eliminations + settings toggle) — cheap, high operator value.
7. P3/P4 copy + notification sweep — one PR each.
8. P5 rate limits + money-path tests — before any marketing push.

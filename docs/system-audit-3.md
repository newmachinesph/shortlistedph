# System audit — round 3 (2026-07-27)

Four fix agents worked the round-2 open list in parallel while a fifth ran the
**integration-seam audit that died on a session limit in round 2** — the one
nobody had ever done. It was the highest-yield of the three rounds, because it
was the only audit looking *between* the parallel agents rather than inside one.

## Fixed this round

**Money**
- **Every PayPal refund was being silently dropped.** Root cause found by the
  money agent, not by any audit: on `PAYMENT.CAPTURE.REFUNDED` the event's
  `resource.id` is the *refund's* id, not the capture's, so
  `markPaymentRefunded` never matched a Payment row. Now reads
  `supplementary_data.related_ids.capture_id`.
- Refund arriving before its capture is recorded as a refunded Payment row;
  `fulfillPurchase` now refuses to grant against one. `custom_id` added at order
  creation so a pre-capture refund has a resolvable payer (PayPal copies
  `custom_id` onto refunds; `reference_id` it does not).
- Webhooks verify the paid amount against the catalog before granting. Fails
  closed — PayMongo's `?? 6000` default (exactly the catalog price) is gone.
- Refund now closes a pending IdentityBinding, so a refunded verification is no
  longer locked out of paying again.
- Cancelling an interview no longer returns a credit backed by refunded money.
- Un-void refuses to resurrect commissions whose payment was refunded.
- `scripts/reconcile-commissions.ts` (dry-run by default) for commissions lost
  to a failed accrual.

**Consent / candidate privacy**
- **The raw employer JD title no longer reaches candidates.** `title` is not even
  selected on the consent paths now; everything routes through
  `candidateRoleLabel` (admin-sanitised `publicTitle` → `roleFamily` → generic).
- Opting out of matching stops queued invitations. Deliberate, commented
  decision: an already-SENT invite stays answerable, because killing a live link
  would let the expiry cron strike someone for an invite we had barred them from
  answering.
- A permanently undeliverable address can no longer starve a JD's whole invite
  budget (`limit` counts deliveries, not attempts; `sendAttempts` column added).

**Engine — ranking semantics changed, deliberately**
- Rotation now costs an *invitation*, not just a placement, so a candidate who
  declines everything no longer leads the queue for every job forever. Declining
  is still cheaper than accepting and still carries no dormancy strike.
- `openToOffers = false` and `availability = "booked"` are now REAL pool filters,
  not tiebreaker nudges. Talent copy updated in the same round — it previously
  promised the exact opposite.
- Stage 0 deepens the pool (3× ANN cut, capped after filtering) instead of
  shrinking it.
- `jdHardRequirements` no longer derives `hoursPerWeekMin` from the JD. The old
  derivation was inverted in meaning: turning the flag on would have eliminated
  every part-timer in the pool on a routine 40h brief.
- No threshold moved. 68 / 55 / 40 and all weights untouched.

**Surfaces / admin**
- An admin can no longer self-demote out of the back office via `/onboarding`.
- Loading, error and not-found boundaries exist (there were none anywhere).
- A partial JD PATCH no longer silently wipes must-haves and hard filters.
- Engagement edits keyed on row id, so correcting a span actually saves.
- A bare `{visibility:false}` no longer resets stability and fires 4 embeddings.
- Audit logs on opening publish/unlist and recording downloads; payout account
  numbers masked to last 4.

**From the seam audit**
- **The rate limiter was trivially bypassable** — it keyed on the *leftmost*
  `X-Forwarded-For` entry, which is the value the client sends. Now takes the
  nearest-proxy entry, preferring Vercel's non-client-writable header.
- **`resumeParse` had a budget and no call** — the one LLM route with no limit.
- `prospect-count` swallowed every error and returned 0, indistinguishable from
  "nobody matches" — the number the whole pre-signup funnel is sold on. Now logs.
- `prospect-count` re-gated to match the engine's new pool filters.
- The schedule route emitted `interview_booked` with a payload that renderer
  ignored ("Your interview with An employer is booked", time discarded) while
  `interview_scheduled` had no writer at all. Fixed both ends.
- Refund notification no longer says credits were "returned" when they were
  revoked.
- Referral code allocation no longer swallows non-collision DB errors.

## Still open

**Highest value**
- **`mustHaves` and `overlap` can name the client** and are rendered verbatim to
  candidates. Same class as the title leak, but fixing it is a product decision:
  dropping must-haves guts the candidate's basis for consenting, and
  `requiredTools` (the leak-safe substitute) discards every non-tool requirement.
  Needs a sanitised `publicMustHaves` with admin review, or a controlled
  vocabulary.
- **Still no tests on any money path.** `fulfillPurchase` idempotency, the P2002
  race that IS the double-credit guard, entitlement arithmetic, and every branch
  added this round are verified by typecheck, lint and reasoning only. These
  modules import `server-only`, which throws under the repo's `node --test`
  harness — so this needs a harness decision, not just effort.
- **Nothing has ever been run.** Three rounds, ~150 files, zero execution against
  a database. Dev holds schema and one admin row.

**Known seams left**
- Constants retyped instead of imported: `VERIFIED_TIER` (8 sites),
  `PAYABLE_TO_INTERVIEWER` (5), `freeHours`/40 (resume parse). Each is a silent
  independent failure when the value changes.
- `ProfileTool` + `JobDescription.requiredTools/preferredTools` are written on
  every profile save and JD save and read by nothing — Phase 3 shipped its
  writer and not its reader.
- `referral-reward.ts` hand-mirrors a type from `payments.ts`; a fourth product
  kind type-checks cleanly and silently earns nothing.
- `notify()` callers double-wrap it in try/catch, so DB read failures inside
  those blocks log as "notifications failed".
- Stale contract comments in `matching.ts` describe a consent-accept re-score
  that no longer exists.
- `rateLimit("profileWrite")` is reused for outcome confirmation, so 30 profile
  saves lock out a monthly confirmation.
- Rate-limit counters are per-instance and reset on cold start; the real ceiling
  is higher than the file documents.
- `approveSlate` can leave an approved slate with zero invitations if the
  best-effort send block throws.
- Dead: `Interview.paymentRef`, `hardRequirements.startWithinDays`,
  `screeningQuestions`/`initialInstructions`/`schedulingUrl`, several env vars
  (Didit, Sentry, Turnstile), three superseded migration scripts.

## Honest state

Build green, lint clean, typecheck clean, 21/21 unit tests — all of which cover
pure logic only. Prod is untouched and still on the pre-baseline schema. The
next increment of confidence comes from **running the thing** and from tests on
the money paths, not from a fourth audit round.

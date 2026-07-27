# System audit — round 4 (2026-07-27)

Five auditors, each on an angle no earlier round took: a producer→consumer
synergy map, adversarial verification of round 3, an end-to-end journey trace
(the substitute for QA on code that has never been run), data integrity and the
migration chain, and security/abuse.

**The headline, from the journey tracer:** on a fresh database the only journey
that completes end to end is the admin's. Every other actor stops on its first
or second step. Three rounds of fixing defects inside flows never established
that the flows themselves connect.

**The second headline, from the verifier:** three of round 3's advertised fixes
do not work, and every new defect it found sits on a seam between two agents who
each assumed the other had done something. That is now four rounds running.

---

## Fixed immediately (commit `3d2ef73`)

- **`amount_mismatch` was unwritable and poisoned the capture id.** The status
  is not in `payment_status_check`, so every mispriced delivery threw `23514`,
  the webhook 500'd and the provider retried forever with the money unrecorded.
  Had the write succeeded it would have claimed the `providerRef`, so the same
  capture redelivered correctly would collide and be swallowed as "already
  processed" — money taken, nothing granted, permanently. Now an `AuditLog`.
  *Found independently by the round-3 verifier and the data-integrity audit.*
- **Root cause of the mismatch:** `captureOrder` did not send
  `Prefer: return=representation`, so PayPal could answer with the minimal
  representation that omits the amount — read as an underpayment on a valid
  payment.
- **The public funnel reported ≈0 prospects.** The engine dropped its capacity
  gate; `prospect-count` kept it, excluding any candidate with a single
  committed hour from exactly the 40h briefs employers most often write.

---

## BLOCKERS — a real user cannot finish the journey

1. **Google sign-in is a closed loop.** A first-time Google user goes to
   `/talent` → `/onboarding` → `/register`, whose submit calls `signUp.email`
   and creates a *second, different* account. Nothing on that path ever calls
   `/api/onboarding/role`, the only writer of `TalentProfile`/`EmployerAccount`.
   The Google account is orphaned forever. The button is live.
2. **Talent onboarding is hard-gated on a parseable resume.** The upload stage
   has no skip and no manual path. A scanned PDF, a legacy `.doc` (accepted by
   the upload route, unreadable by `mammoth`), or any OpenAI hiccup leaves the
   user permanently on the upload screen. No profile can be created.
3. **Employer brief creation is hard-gated on the LLM.** The only transition out
   of `compose` is a successful `/api/jds/draft`. An OpenAI outage means no
   employer can post a job.
4. **A booked interview can never take place.** `Interview` has `scheduledAt`
   and `recordingKey` and **no meeting link and no contact field**. The
   interviewer's card carries no candidate email; the candidate is told "you'll
   be contacted"; the employer is told "we're arranging a time". Nobody in the
   system can send anyone a join link — while `/apply/interviewer` promises
   "run the call on your own meeting tool", with no field to share it.
5. **Interviewer payouts have no destination.** No payout fields on
   `Interviewer`, no request action, no confirmation. *(Also synergy RANK 2.)*
6. **The migrated pool is inert.** Imported with `publishedAt: null` and no
   `Account` row, so they are outside the matching pool AND have no password.
   The "re-activation email" the migration script cites does not exist anywhere
   in the repo. Even reached by a consent link, the follow-up lands on a
   session-gated page they cannot log into.

## SECURITY

- **HIGH — no presigned upload enforces size.** Every caller checks a
  client-declared `sizeBytes` in application code and then signs a bare
  `PutObjectCommand`. Any signed-in account can PUT a 10 GB body, repeatedly,
  to a CDN-public prefix, and `PATCH /api/account/avatar` points `User.image`
  at it without checking the object at all. Free public file hosting on our bill.
- **HIGH — email verification is configured but never enforced.** No
  `requireEmailVerification`, and nothing reads `emailVerified`. Enables account
  squatting, and defeats every per-user rate limit in the app, since accounts
  are free and instant.
- **HIGH — two embedding endpoints have no rate limit.** `/api/talent/publish`
  and `/api/talent/availability` each fire four embeddings per call on up to
  32 KB. The buckets exist; the calls were never added.
- **MEDIUM — the resume injection guard is bypassed by our own template.**
  `templateOverrides` runs *after* `scrubExtraction` and writes `headline`,
  `summary`, `city` and `tools` verbatim from the raw document. The manual
  profile editor has no guard at all, so the cheap path never even raises the
  flag. Capped at MEDIUM because no profile text reaches a second LLM prompt.
- **MEDIUM — `requirePageUser` never checks `user.status`.** Every page renders
  for a suspended or banned user; only writes 403. Currently masked because
  suspension also deletes sessions — any future status write reopens it.
- **MEDIUM — employer recording links.** 1-hour presigned URLs minted for every
  reported interview on page load, embedded in HTML, with no audit row. The
  admin path already does this correctly.

**Verified clean, and worth stating:** IDOR across all 63 route handlers
(scoping is in the WHERE clause, not post-fetch); **the paywall** — `maskEntry`
builds the locked object from scratch and both call sites never load names into
memory when locked, so a serialization bug could not leak them; the consent
token's grant and lifetime; every raw SQL site; both webhook signature paths;
session handling and `role`/`status` being server-set; secrets.

## DATA INTEGRITY

- **CRITICAL — deleting one talent profile destroys the employer's paid
  shortlist**, agreements, ratings, and reported interviews an interviewer is
  owed for. `Entitlement.spentOn*Id` have no FK and dangle silently, so
  reconciliation reports drift `0` while being unauditable. Contradicts the
  schema's own stated first principle.
- **CRITICAL — `Payment` and `ReferralPayout` cascade from `user`.** Deleting an
  affiliate destroys paid payouts and makes their commissions owed again. The
  `protect_commission_history` migration fixed the conversion edge, not this one.
- **HIGH — no `credits >= 0` CHECK.** The invariant lives in five app guards and
  zero DB constraints. No CHECK on `Entitlement.kind` either — a bad value
  vanishes from reconciliation instead of showing as drift.
- **HIGH — `Interview.status = 'recorded'` is a permanent trap.** Not cancellable
  by anyone, no cron sweeps it, and revoking the assigned interviewer strands it
  forever.
- **HIGH — `hnsw.ef_search` is never set** (default 40), so Stage 0's "3× deeper
  pool" cannot return more than ~40 rows. Round 3 shrank the delivered pool while
  documenting that it deepened it.
- Verified: the hnsw hand-edit discipline held across all four migrations, and
  `migrate deploy` from baseline works.

## SYNERGY — producers without consumers

- **Interview assessments die where they land.** Not in the dossier, not in
  `maskEntry`, not in scoring, and **not to the candidate** — who consented to
  being recorded under RA 10173 and has no route to their own recording or
  assessment.
- **A confirmed hire changes nothing about capacity or rotation.** A candidate
  working 40h/week for someone else still scores as fully free and keeps
  receiving invitations they must decline — which round 3's rotation change now
  charges them for.
- **`ProfileTool` and `requiredTools`/`preferredTools`** are written on every
  save and read by nothing. The exact-tool matching they exist for does not
  happen.
- **Ratings have no aggregate consumer.** Both sides file into a system where
  the only reader is the person being rated.
- **Banning a user leaves their `Interviewer` row active** and bookable.

## ROUND-3 FIXES THAT DO NOT WORK

- The mass-elimination bug is still live: `jdHardRequirements` returns the
  stored JSON before reaching the corrected derivation, and round 3's own JD
  PATCH now rewrites that JSON on every edit.
- `sendAttempts` is a dead column — shipped with a migration and a schema
  comment describing parking behaviour nobody implemented.
- Opt-out still doesn't stop queued invitations: the consent agent filtered on
  `visibility` while the engine agent redefined opt-out as `openToOffers`.
- ~~Partial refunds revoke the entire purchase.~~ **Fixed and executed.**
  Revocation is now proportional to what actually came back, the running total
  lives on `Payment.refundedAmount`, and `refundRefs` makes a redelivered refund
  webhook a no-op — `providerRef` only ever made the *capture* idempotent. Only
  a full refund flips `status`, closes a verification or voids the commission.
  Proven by `npm run test:money`: the four partial-refund tests failed against
  the old code and pass against the new.
- ~~The PayMongo webhook has the exact id-mismatch twin of the PayPal bug round
  3 fixed.~~ **Fixed.** A refund delivery carries the refund (`ref_…`), and the
  payment is in `attributes.payment_id` — confirmed against PayMongo's current
  docs, not assumed.

---

## The honest read

Four rounds have produced a codebase that compiles, lints, typechecks, passes 21
pure-logic tests, and **has never been executed**. Each round's fixes are
individually well-reasoned; each round's damage is entirely in what one parallel
agent assumed another had done. New defects are now being introduced at a rate
close to what is being removed.

The next increment of confidence does not come from a fifth audit. It comes from
running the application and from tests on the money paths.

**Both now exist** (2026-07-27). `npm run smoke` drives the core loop against a
running app; `npm run test:money` runs the refund ledger against a real
Postgres. The two money bugs above were fixed under tests written to fail
first — which is the difference between this round and the four before it.

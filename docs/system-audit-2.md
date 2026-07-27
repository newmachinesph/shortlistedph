# System audit — round 2 (2026-07-27)

> **SUPERSEDED — see `docs/system-audit-3.md` for the live list.** Everything in
> the "NOT fixed" section below was worked in round 3, and the fifth audit that
> died here was re-commissioned and completed there.

Four fresh auditors re-checked the round-1 rebuild (`32e8fce`) adversarially:
money/ledger, matching engine, employer+talent surfaces, admin+auth. A fifth
(cross-cutting: security, dead code, integration seams) died on a session limit
and never ran in this round.

Their verdicts on round 1 were mixed, and several of the worst findings were
bugs round 1 *introduced*. That is the value of the exercise; it is also why
nothing here should be trusted without the same treatment.

## Fixed in this round (commit follows this doc)

| # | Defect | Origin |
|---|---|---|
| 1 | **Unlock spent the wrong entitlement kind.** The lookup had no `kind` filter and no `spentOnInterviewId` guard, so a shortlist unlock could stamp an *interview* credit — swapping both ledgers, leaving the real shortlist entitlement "unspent" for a refund to claw back while the slate stayed unlocked, and re-marking rows already spent. | pre-existing, missed by round 1 |
| 2 | **Refund clobbered concurrent balance writes.** `markPaymentRefunded` read `credits` and wrote back an absolute `read − n`, losing any unlock or interview confirm that committed in between. Now atomic `decrement` with the floor in the WHERE. | **round 1** |
| 3 | **Refund with no employer row silently reported success** — entitlements revoked, balance untouched, audit meta claiming a clawback. Now logged loudly. | **round 1** |
| 4 | **Employer cancel was a second, unguarded implementation** — read status, then wrote `cancelled` unconditionally. A confirm in that window left a spent credit on a dead interview, nothing returned, nobody notified. Now delegates to `cancelInterview`. | **round 1** (left the old route in place) |
| 5 | **Schedule and recording routes could resurrect a cancelled interview** via unconditional updates after a stale read — carrying it to `reported` and into a payout for work the employer was refunded, and enabling a *second* credit return. Both now conditional. | pre-existing |
| 6 | **Admin could cancel delivered work**, erasing the interviewer's earnings with nothing returned to anyone. Delivered is now uncancellable by everyone; the admin UI offers the action only where the API accepts it (`CANCELLABLE`). | **round 1** |
| 7 | **`seed-interviewers.ts` still wrote `role: "interviewer"`** — the exact bricked-account bug round 1 claimed to fix, surviving in a script nobody re-read. Infinite redirect + every talent route 403. | **round 1** (incomplete) |
| 8 | **Revoked interviewers kept full read access** to candidate names, cities, skills and employers' private notes. Only `pending` was special-cased; writes 403'd, which made it silent rather than safe. | **round 1** |
| 9 | **A failed publish wedged the JD forever** at `matching`: PATCH refuses non-draft, re-publish refuses non-draft, page says "ranking the market" indefinitely. The status flip is a lock and now releases to `failed`. | pre-existing, exposed by round 1's new edit route |
| 10 | **Dormancy strike for ignoring a closed role.** Accepting a closed role is refused, so the only way to avoid exclusion from *all* matching was to decline a job you could never take. Also: answering late to decline no longer costs a strike. | pre-existing |
| 11 | **Interviewer payout could double-pay** — no `payoutId: null` guard on the claim write, so two operators both created a full payout for one batch. | pre-existing |
| 12 | **Admin credit deduction orphaned entitlements**, adding permanent positive drift to the reconciliation view built to detect it, with no way to clear it. Deductions now revoke rows. | pre-existing, flagged in round 1 and not fixed |
| 13 | `syncProfileTools` dropped `years`/`lastUsedYear`/`category` on rename and was non-transactional. | **round 1** |

## NOT fixed — still open, ranked

**P0**
- **Refund delivered before capture is silently dropped** (`fulfillment.ts`: no Payment row → `return`, no log). PayPal does not guarantee ordering; the capture then grants credits *and* a $9 commission for money already returned. Needs a pending-refund record replayed on capture.
- **Raw employer JD title reaches candidates** on the consent email and the in-app invitations page. The repo's own leak test asserts this field "can contain a client name" and the public board fails closed on it; the consent path has no such guard. Needs the same `publicTitle`/admin-sanitisation treatment.
- **Visibility off does not stop already-queued invitation emails.** `sendConsentRequests` filters on JD status only. The toggle's copy promises otherwise.

**P1**
- Commission still permanently lost if `recordCommission` throws (own catch, but no retry and fulfilment is idempotent). Also lost if the conversion or employer row does not exist yet at payment time. Needs a reconcile job.
- Refund-voided commissions can be resurrected by admin un-void when the conversion was voided *first* (the refund's `updateMany` matches 0 rows and leaves no trace).
- Refund + later interview cancel returns a credit backed by refunded money.
- **Unsent consents burn a JD's invite budget**: a persistently failing send is re-picked oldest-first every hour, blocks the slot, and counts against the `SLATE_SIZE × 3` cap — a JD can log "pool exhausted" with zero emails ever delivered.
- **Serial decliners monopolise the rotation.** `shortlistCount` increments only on accept and is the primary sort key, so someone who declines everything leads every slate forever.
- **`openToOffers` filters nothing** — it is a tiebreaker nudge. Candidates who turned it off are still ranked, emailed and shortlisted, and the employer sees "Not open to offers" on someone the engine just placed.
- **Booked candidates are shortlistable whenever Stage 0 is off** (the default) — overlap is only 15% of the composite.
- **Flipping Stage 0 on will mass-eliminate on hours**: the derived fallback sets `hoursPerWeekMin` from the JD, and resume parse writes non-zero `committedHours` for most imported profiles. Measure before flipping.
- **Unlocked-but-thin slate is a dead end** — no lever, employer or admin, gets more candidates onto a paid JD.
- **An admin can self-demote out of the back office permanently** via `/onboarding` (nothing in the app ever writes `role: "admin"`).
- **No loading/error/not-found boundaries anywhere** in `src/app`.

**P2** — Stage 0 filters after the ANN cut (shrinks the pool instead of deepening it); pool cut uses whole-profile vectors while scoring blends facets; webhooks never check paid amount against the catalog; refunding a verification leaves the buyer locked out; `JdBody.mustHaves` defaults to `[]` so a partial PATCH wipes hard filters; engagement edits keyed on `role|company` silently discard span corrections; `aboveBudget` still computed and discarded; turning Stage 0 off wipes stored elimination evidence; unbounded money queries; several missing audit logs (openings publish, recording downloads); unmasked payout account numbers in admin.

## The honest state

- **The fifth audit never ran.** Integration seams between six parallel agents, a full security sweep, and dead-code inventory are unexamined.
- **No test covers any of this.** `fulfillPurchase`, `markPaymentRefunded`, `confirmInterview`, `cancelInterview`, `adjustEmployerCredits`, both webhooks and every admin route have zero regression guards. Every fix above is verified by typecheck, lint, build and reasoning — not by execution.
- **Nothing has been run against a database.** Dev has schema + one admin row; no flow has been exercised end to end.
- **Prod is untouched** and still on the pre-baseline schema.

# VERIFICATION.md — identity verification: current state, exposure, target design

Talent are charged ₱60 for an identity check that does not exist. There is no Didit integration in this repo — `src/components/didit-mockup.tsx` is a screenshot of Didit's UI in a phone frame, not a client. `POST /api/paymongo/checkout` will take the money and `fulfillPurchase` will write an empty `IdentityBinding` row, and nothing further will ever happen to it. Read section 2 before shipping anything on the talent side.

The mitigating fact, and it is a real one: **nothing calls that checkout route.** `grep -rn "paymongo/checkout" src/` returns zero hits. No UI entry point exists, and per `BACKEND.md` no live PayMongo call has ever been made. So today the exposure is latent, not realised — no talent has been charged. The window to fix this for free is open and closes the moment someone wires a button to that endpoint.

---

## 1. Current state — what actually happens when talent pays ₱60

Traced end to end.

| Step | File | What happens |
|---|---|---|
| Product definition | `src/lib/payments.ts:28-34` | `verification` — ₱60.00 PHP, `kind: "verification"`, `credits: 0`. Comment claims "Passed through to Didit at cost". Nothing passes it through. |
| Checkout | `src/app/api/paymongo/checkout/route.ts` | Requires talent role + profile, 409s if already `id_verified` or already paid, then `createQrPayment` with `metadata: { userId, productId }`. Returns a QR Ph code. |
| Payment confirmation | `src/app/api/paymongo/webhook/route.ts:50-73` | On `qr.paid` / `payment.paid` / `checkout_session.payment.paid`, resolves the user from metadata (never from the browser — correct) and calls `fulfillPurchase`. |
| Fulfilment | `src/lib/fulfillment.ts:61-70` | For `kind: "verification"`, upserts an `IdentityBinding` row with **only** `userId`. `diditSessionRef`, `faceEmbeddingRef` and `verifiedAt` are all left null. Writes an `AuditLog` entry `payment.verification`. |
| Badge | — | `TalentProfile.verifiedTier` is never written by any code path. `grep -rn "verifiedTier" src/` shows only reads. |

So the money buys one empty database row and an audit log line. There is no Didit session, no redirect, no webhook endpoint, no `src/app/api/verification/*` route, no `src/app/api/webhooks/didit/*` route. The three env slots — `DIDIT_API_KEY`, `DIDIT_WORKFLOW_ID`, `DIDIT_WEBHOOK_SECRET` — are declared in `.env.local` and read by nothing.

The design intent is sound and is documented in the code itself (`src/lib/fulfillment.ts:62-64`: "paying must never be enough to look verified"). The badge correctly cannot be bought. The defect is that it also cannot be earned — there is no path from ₱60 to `verifiedTier = "id_verified"` at all. A talent who pays enters a state with no exit.

Two further gaps worth naming now:

- **No refund path for this product.** `markPaymentRefunded` (`src/lib/fulfillment.ts:96`) flips a status string when PayMongo tells us a refund happened. It does not initiate one. If we need to give ₱60 back we do it by hand in the PayMongo dashboard.
- **No retry semantics.** The checkout route 409s on any prior `status: "paid"` verification payment. That is the right default (see section 3) but it means a talent whose check fails is permanently locked out of retrying through the normal flow, with no admin override implemented.

---

## 2. The exposure, and how to close it

**Charged for:** "Identity verification" (`src/lib/payments.ts:31`), described on `src/app/for-talent/page.tsx:88-93` as "₱60, none of it ours… That is what the check costs and we keep none of it", and on `src/app/pricing/page.tsx:75` as "a check run by an outside provider".

**Delivered:** an empty row.

That is a fee collected for a service not rendered. Under PH DOLE D.O. 141-14 the recruitment-adjacent context makes worker-charged fees a live regulatory question regardless of amount, and the "at cost, passed through" justification is the entire defence of this fee. That defence evaporates if there is no cost being passed through — ₱60 that reaches no provider is ₱60 of revenue, and revenue charged to a worker in a hiring pipeline is exactly the thing D.O. 141-14 exists to constrain. The claim "none of it ours" is currently false as a matter of fact.

### Option A — pause the fee until verification is real

Do not ship any UI that calls `POST /api/paymongo/checkout`. If it has already shipped, remove the entry point and refund every `Payment` row with `purpose = "verification"` and `status = "paid"`.

- Cost: verification is unavailable until Didit is integrated. Given it is already labelled optional everywhere and contributes only `VERIFIED_BONUS = 4` to a 100-point score (`src/lib/scoring.ts:141`), the product loss is small.
- Benefit: the exposure goes to zero. Nothing is claimed that is not delivered.
- Today this costs nothing at all, because the entry point does not exist yet. It is a decision to *not* build one thing until another thing exists.

### Option B — keep charging, run a documented manual review

Charge the ₱60, then have a human review a live video call or a document shown on screen (never uploaded) against a checklist, and set `verifiedTier` on the strength of that.

- Cost: the ₱60 no longer maps to a third-party invoice, so "none of it ours" becomes indefensible and the copy must change to something like "covers the cost of the check" with our own labour as the cost. That is a much weaker regulatory position than a pass-through, and it converts an outside-provider fee into a fee we charge for our own service — which is the shape D.O. 141-14 scrutinises hardest.
- Cost: it needs a real reviewer with real SLA capacity from day one, or it becomes the same broken promise with extra steps.
- Benefit: talent get a badge; the flow ships without waiting on Didit.

### Recommendation: Option A

Pause. The reasoning is not primarily legal caution, it is that Option B trades a clean, defensible pass-through fee for a murky one, permanently, in exchange for shipping a low-value optional feature a few weeks earlier. `VERIFIED_BONUS` is 4 points. That is not worth the copy rewrite, the reviewer headcount, or the weakened D.O. 141-14 position.

Manual review still gets built — but as the **fallback** for when Didit fails (section 5), funded by the Didit fee that was already collected for that attempt. That keeps the pass-through story true: the money bought a check, the check was attempted with the provider, and a human finished it when the provider could not.

---

## 3. Target workflow

State lives in `IdentityBinding` plus `TalentProfile.verifiedTier`. Today there is no status column; see Open Decisions.

```
unverified ──pay──> pending ──Didit approves──> verified
                       │
                       ├──Didit declines──────> rejected
                       ├──session abandoned───> expired
                       └──Didit unavailable───> manual_review ──> verified | rejected
```

1. **Trigger.** Talent clicks "Verify my identity" on `/talent/profile`. Purely opt-in; nothing in the product blocks an unverified talent from being matched, shortlisted, or hired. State: `unverified`.
2. **Pay.** `POST /api/paymongo/checkout` returns a QR Ph code rendered in our own modal. Talent pays from GCash/Maya/bank app. The tab may never come back — the webhook is the truth (`src/app/api/paymongo/webhook/route.ts:9-11`).
3. **Fulfilment creates the attempt.** `fulfillPurchase` upserts `IdentityBinding` and — new — creates the Didit session and stores `diditSessionRef`. State: `pending`. Talent sees "Payment received. Opening your check with Didit."
4. **Redirect.** Talent goes to Didit's hosted flow: ID document, liveness selfie, roughly four minutes (matches the claim on `src/app/for-talent/page.tsx:79`). We render nothing of the check ourselves. On completion Didit returns them to `/talent/profile`.
5. **Return.** The redirect proves nothing — the talent sees "Check submitted. This usually takes a few minutes." The page polls. State stays `pending` until the webhook says otherwise.
6. **Webhook decides.** Approved → write `verifiedAt`, `faceEmbeddingRef`, set `TalentProfile.verifiedTier = "id_verified"`. State: `verified`. Declined → state `rejected`, talent sees the reason category Didit gives us and nothing more.
7. **Failure.** On `rejected`, the talent is offered the manual review in section 5 at no extra charge. On `expired` (session created, never completed within Didit's session window), the talent may resume with a fresh session against the same payment.

**Does a retry cost again?** No, not within the paid attempt. One ₱60 payment buys one *verified outcome attempt*, including: any number of restarts of an expired or abandoned session, and one manual review if the automated check fails or is unavailable. A talent who is genuinely rejected — the document is not theirs — does not get a second ₱60 attempt at all; that is a support conversation, not a self-serve retry. This is the only position consistent with the pass-through claim: charging twice for one identity means the second ₱60 is not covering a cost, it is a penalty. The current `409 Verification already paid for` check (`src/app/api/paymongo/checkout/route.ts:21-24`) already enforces one-payment-per-user and should stay.

**How long does verification stay valid?** The honest answer is already on the site: "Verification is a moment, not a subscription. Someone can verify honestly in April and hand the laptop to a cousin in June" (`src/app/for-employers/page.tsx:36`). Proposal: the badge does not expire, but `verifiedAt` is surfaced to employers as a date, not a boolean — "ID-verified March 2026" rather than "Verified". A stale check is then visibly stale and the employer decides what that is worth. No re-verification treadmill, no second fee. See Open Decisions if anyone wants a hard expiry instead.

---

## 4. Didit integration plan

Didit's exact endpoint paths, request bodies, response fields, event names and signature scheme are **to be confirmed against their current API documentation before implementation**. What follows commits to the shape (session create → hosted flow → webhook verdict) and to what we store; it does not invent their wire format. The remotetalentph repo has a working Didit webhook handler with three signature schemes (`BACKEND.md` line 147) — port it and re-verify it against current docs rather than writing fresh.

### Routes

Two new routes, matching the surface already planned in `BACKEND.md` line 89:

- `POST /api/verification/session` — creates or resumes a Didit session for the authenticated talent. Requires an `IdentityBinding` row whose payment is settled. Stores the returned session identifier as `IdentityBinding.diditSessionRef` and returns the hosted-flow URL. Idempotent: if a live `diditSessionRef` already exists, return that session rather than creating a second one. Sessions are also created inline by `fulfillPurchase` at step 3; this route exists for resume-after-expiry.
- `POST /api/webhooks/didit` — the verdict. Follows the conventions established by `src/app/api/paymongo/webhook/route.ts` and `src/app/api/paypal/webhook/route.ts` exactly:
  1. Read the raw body with `await req.text()` before parsing anything. Signature verification is over raw bytes.
  2. Verify the signature using `DIDIT_WEBHOOK_SECRET`. Fail closed if the secret is absent — the PayMongo and PayPal verifiers both do this and the property is asserted in `BACKEND.md` line 109. Invalid signature → `401`, log, write nothing.
  3. Parse JSON; malformed → `400`.
  4. Resolve the talent from `diditSessionRef`, never from anything in the payload claiming to be a user id. Unknown ref → `200 { received: true, ignored: "unknown session" }`.
  5. Approved verdict → idempotent fulfilment in one transaction (below). A second delivery of the same verdict must be a no-op, not a second write.
  6. Any event type we do not act on → `200 { received: true, ignored: type }`. Non-2xx makes the provider retry, and retrying something we deliberately ignored is noise.
  7. Genuine processing failure → `500`, so the retry is useful.

Register the webhook at deploy time only. Like PayMongo, expect the provider to validate that the URL resolves; local development needs a tunnel and a separate registration.

### Env vars

| Var | Use |
|---|---|
| `DIDIT_API_KEY` | Server-side auth for session creation. Never reaches the client. |
| `DIDIT_WORKFLOW_ID` | Which Didit workflow to run — determines which documents and checks apply. |
| `DIDIT_WEBHOOK_SECRET` | Signature verification on `/api/webhooks/didit`. Verifier fails closed when unset. |

All three slots already exist in `.env.local` and are currently unread.

### What gets written to IdentityBinding

On an approved verdict, in one transaction:

```
IdentityBinding.diditSessionRef   = <opaque provider session reference>
IdentityBinding.faceEmbeddingRef  = <opaque reference to the face embedding>
IdentityBinding.verifiedAt        = <verdict timestamp>
TalentProfile.verifiedTier        = "id_verified"
AuditLog                          = { action: "verification.approved", target: diditSessionRef }
```

**No identity documents are ever stored.** This is a design rule, not a preference, and it is already promised publicly on `src/app/for-talent/page.tsx:18` ("Neither ever reaches our servers… we receive a pass or fail and a timestamp") and `:22` (the PhilSys number is sensitive information under RA 11055 and we never ask for it). Concretely, the following must never be written to our database, R2, or logs: ID images, selfie images, document numbers, the PhilSys 12-digit number, date of birth, or address. `faceEmbeddingRef` is a reference to a face embedding, not the embedding of a stored photo we keep — whether the vector itself lives here or at Didit is an open decision below. If a Didit payload contains document fields, the handler must extract only the verdict, the timestamp and the two references, and must not log the raw body on the success path.

A declined verdict writes `AuditLog` and the rejection state. It does not write `verifiedAt` and does not touch `verifiedTier`.

---

## 5. Manual review fallback

Triggered when: Didit returns a decline the talent disputes, Didit is unavailable or erroring, or the talent cannot complete the flow (no supported document, repeated liveness failure, device limitations). Included in the ₱60 already paid — never a second charge.

**Who reviews.** An admin, from `/admin`, gated by the existing `ADMIN_EMAILS` allowlist. Not a support contractor, because the reviewer sees a live human's identity document on a call.

**How.** A scheduled video call. The talent holds the document to camera. Nothing is uploaded, nothing is screenshotted, nothing is retained. The reviewer works a checklist:

- The document is a PhilID, Philippine driver's licence, or Philippine passport.
- The document is physically present, not a photo of a photo or a screen.
- The face on the document is the face on the call.
- The name on the document matches the account name.
- Security features present as expected for the document type.
- The talent can answer one non-obvious question about the document that a holder would know and a possessor might not.

**Recorded where.** `AuditLog` only, and only these fields: `actorId` = the reviewing admin, `action` = `verification.manual_approved` or `verification.manual_rejected`, `target` = the talent's user id, `meta` = `{ documentType, reviewedAt, checklistVersion }`. The document number does not go in `meta`. On approval the same `IdentityBinding` writes happen as in section 4, with `diditSessionRef` left as whatever the failed Didit attempt produced (or null) and `faceEmbeddingRef` null — a manual review produces no face embedding, which weakens the anti-ban-evasion property in section 6 and is a known and accepted tradeoff for a rare path.

**SLA.** Call offered within 2 business days of request; verdict written during the call. If the queue exceeds that, verification requests pause rather than accumulating — an unverified profile costs the talent 4 score points, an unanswered promise costs more.

---

## 6. What verification is actually for

Two things, and it is worth being precise because the word "verified" is used loosely across this industry.

**Stopping banned users re-registering.** This is the main one and it is why `faceEmbeddingRef` exists. When someone is banned after a `Report` resolution, a new signup with a fresh email and a fresh phone number is trivial — `BACKEND.md` line 21 already rejects SMS verification for exactly this reason ("PH SIMs are disposable; phone = contact info, never identity"). A face embedding is the one identifier a person cannot regenerate. Bans are therefore identity-bound (`BACKEND.md` P4) rather than account-bound.

**Stopping fake profiles.** A profile behind a verified identity has a real person attached who can be reported, banned, and kept out. It raises the cost of running twenty synthetic candidates from a farm.

**What it does not prove.** Already stated correctly on `/for-employers` and worth restating so nobody drifts: it does not prove skills, does not prove work history, does not prove the person will do the work themselves after hiring, and does not prove anything about the day after the check. `src/app/for-employers/page.tsx:36` — "Verification is a moment, not a subscription." It also does not prove a clean criminal record; that is an NBI clearance, which we deliberately never touch (`src/app/for-talent/page.tsx:131-136`).

---

## 7. Regulatory posture

The position is already established across the repo and this section reflects it rather than proposing a new one.

**The rule.** PH DOLE D.O. 141-14 governs how fees may be charged to workers in recruitment contexts. The repo's stance is stricter than the minimum: we charge workers nothing for placement, ever. `src/app/pricing/page.tsx:75` — "Never to be listed, matched, shortlisted, prioritised, or hired. Placement fees are the oldest recruitment scam in Philippine hiring and we will not touch them."

**Why the fee must stay decoupled from ranking.** The ₱60 survives only as a pass-through for a third-party check that the talent may decline with no structural penalty. The moment it buys ranking, it is a placement fee wearing a costume. Two things protect this today and both must be defended in review:

- The fee is not a ranking input. Payment writes an empty `IdentityBinding` and nothing else (`src/lib/fulfillment.ts:65-69`). Ranking reads `verifiedTier`, which is set by an identity verdict, not by a payment.
- The badge's ranking effect is deliberately tiny: `VERIFIED_BONUS = 4` out of 100 (`src/lib/scoring.ts:141`), applied after the four real dimensions. This backs the public claim that "verification breaks ties, it doesn't win them" (`src/app/for-talent/page.tsx:166`, `src/app/for-employers/page.tsx:116-119`). Raising this number is a regulatory change, not a tuning change. Treat any PR touching it as requiring the same scrutiny as a copy change to the pricing page.

**What the copy may claim.** That verification is optional; that unverified talent are shortlisted and hired the same as anyone else; that the ₱60 is what the check costs and we keep none of it; that documents never reach our servers.

**What the copy may not claim.** That verification improves placement odds, gets you seen first, gets you prioritised, or is expected by employers. Not "boost your profile", not "stand out", not "get hired faster". And — the live one — **it may not claim the check runs at all until it does.** Every "none of it ours" and "at cost" sentence on `/for-talent` and `/pricing` is presently unbacked by any code. Either the integration lands or those sections come down; there is no third option that leaves the copy standing.

---

## 8. Open decisions

1. **Pause or manual-review?** Section 2 recommends pausing — do not ship a verification entry point until Didit is integrated. Alternative: ship manual review now and rewrite the "at cost, none of it ours" copy. Which?
2. **Where is the status stored?** `IdentityBinding` has no status column, so `pending` / `rejected` / `expired` are currently unrepresentable. Options: (a) add `status String @default("unverified")` to `IdentityBinding`; (b) infer status from the nullability of `diditSessionRef` and `verifiedAt`, which cannot distinguish rejected from expired; (c) extend `TalentProfile.verifiedTier` beyond `none | id_verified`. Recommendation is (a), but it is a migration and needs sign-off.
3. **Does the badge expire?** Section 3 proposes no expiry, with `verifiedAt` shown to employers as a date so staleness is visible. Alternative: hard expiry at 12 or 24 months — which then raises whether re-verification costs another ₱60, and a recurring worker-charged fee is a materially worse D.O. 141-14 position. Which?
4. **Where does the face embedding live?** (a) Didit holds it, we store only an opaque reference — cleanest for the "we store nothing" promise, but ban-evasion matching then depends on Didit's dedup features and their availability. (b) We store the vector in pgvector alongside profile embeddings — makes matching ours to control, but a database of Filipino workers' biometric vectors is precisely the target `src/app/for-talent/page.tsx:110-113` says we refuse to become. Needs a decision and probably a lawyer.
5. **Does a genuinely rejected talent get a second paid attempt?** Section 3 says no — support conversation, not self-serve. Alternative: allow one paid retry after 30 days. The first is cleaner for the pass-through claim; the second is kinder to someone whose first document was genuinely bad.
6. **Who staffs manual review, and what happens when the 2-business-day SLA is missed?** Section 5 proposes pausing new verification requests rather than queueing. Alternative: keep accepting and let the queue grow with a visible wait time shown at checkout.
7. **Refunds.** No refund is initiated by any code path; `markPaymentRefunded` only records one PayMongo already performed. If we pause the fee after money has been taken, or a manual review is never delivered, is the refund manual via the PayMongo dashboard (acceptable at low volume) or does it need an admin action in-product?

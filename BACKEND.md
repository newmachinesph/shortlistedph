# BACKEND.md — implementation plan

Contract for turning the static prototype into a working platform. Written July 2026. Treat as the CONTRACT.md for the backend build: get sign-off on deviations before implementing them.

## Locked stack

| Concern | Choice | Notes |
|---|---|---|
| Hosting | Vercel | cron included |
| DB | Neon Postgres + **pgvector** | one DB for relational + embeddings; PITR on from day one |
| ORM | Prisma | schema below |
| Auth | **BetterAuth** + Google OAuth + email/password | pull current BetterAuth docs before coding — it moves fast |
| Files | Cloudflare R2 | presigned uploads; resumes + logos only. Identity documents are NEVER uploaded anywhere |
| AI | OpenAI API | extraction + `text-embedding-3-small`; model IDs in one config constant |
| Email | Resend + react-email | port components from remotetalentph |
| Payments (employer) | PayPal, USD — **Merchant app** (not Platform/Marketplaces), Orders v2 | $49 unlock / $119 three-pack / $249 desk → credit ledger; referrer payouts later = Payouts on same merchant account |
| Payments (talent) | PayMongo, PHP — **QR Ph only** | single product: ₱60 Didit verification pass-through, labeled "at cost". Webhook events: if hosted Checkout Session → `checkout_session.payment.paid`; if direct QR API (preferred UX: QR in our own modal) → `qr.paid` + `qr.expired` (+ `qrph.expired` if on the older QRPh resource). Both paths also subscribe `payment.failed`, `payment.refunded`, `payment.refund.updated`. Register webhooks at deploy time only — PayMongo validates the URL resolves; local dev uses a separate tunnel webhook. Handler: verify `Paymongo-Signature`, idempotent, one event = fulfillment truth |
| KYC (optional) | Didit | port webhook integration from remotetalentph; verify current pricing |
| Anti-bot | Cloudflare Turnstile | register, report, contact |
| Errors | Sentry | |
| No SMS verification | — | PH SIMs are disposable; phone = contact info, never identity |
| No realtime vendor | — | polling w/ silent refetch (5s thread / 15s list); Ably only if usage proves it |

## Data model (Prisma sketch)

Core principle: **the snapshot is the product.** Slates reference frozen profile snapshots, not live profiles.

```
User            id, email, role (talent|employer|admin), authProviderIds, status, createdAt
TalentProfile   userId, headline, summary, city, yearsExperience, rateUsd,
                availability, committedHours, visibility, verifiedTier (none|id_verified),
                embedding vector(1536), publishedAt, lastEditedAt
RateChange      profileId, oldRate, newRate, changedAt          // history visible to employers; 30-day lock enforced in API
Skill           profileId, name, normalizedName, confirmed      // confirmed = backed by OutcomeConfirmation
Engagement      profileId, role, company, span, outcome (confirmed|reported)
EmployerAccount userId, companyName, blurb, location, contactName   // no KYB by design
JobDescription  employerId, title, budgetMin/Max, hoursPerWeek, overlap,
                mustHaves[], niceToHaves[], screeningQuestions Json, initialInstructions,
                schedulingUrl, status (draft|matching|slate_ready|closed), embedding vector(1536)
ProfileSnapshot profileId, jdId, frozenJson, createdAt          // what employers actually see
Slate           jdId, status, deliveredAt
SlateEntry      slateId, snapshotId, rank, score, dims Json, reasons[]
Entitlement     employerId, kind (credit), source (paypal orderId), spentOnSlateId?
Connection      slateEntryId, state (requested|consented|declined|expired),
                screeningAnswers Json, contactRevealedAt
Agreement       connectionId, terms Json, talentSignedAt, employerSignedAt, pdfKey (R2)
OutcomeConfirmation  agreementId, period, talentConfirmedAt?, employerConfirmedAt?
Rating          agreementId, direction, stars, categories Json, revealedAt   // double-blind: reveal when both exist or 14d
Report          filedById, againstUserId, reason, detail, evidenceKeys[], status, resolution
Payment         userId, provider (paypal|paymongo), providerRef, amount, currency, purpose, status
Notification    userId, type, payload Json, readAt
Message         connectionId, senderId, body, createdAt
IdentityBinding userId, faceEmbedding?, diditSessionRef?        // dedup bans; no documents stored
AuditLog        actorId, action, target, meta                  // port pattern from remotetalentph
```

## Matching pipeline (the product)

1. JD published → embed (title + must-haves + summary).
2. pgvector cosine top-50 against published, visible, non-banned profiles.
3. Deterministic dims per candidate — same four the UI already shows:
   - `skills`: overlap of normalized skills, embedding-similarity for synonyms; **confirmed skills weighted ~2× self-reported**
   - `rate`: position of standing rate inside budget band (in-band=100, near=partial, far=0)
   - `overlap`: candidate committed hours + timezone vs required overlap
   - `experience`: years + confirmed-engagement count vs requirement
4. Composite score; take top 20 → one OpenAI call generates the "why shortlisted" reason bullets from the structured comparison (LLM writes prose, never decides rank).
5. Freeze `ProfileSnapshot` for the top 5 → create Slate → notify employer. Honest-flag entries below threshold (like the Kevin Salazar demo card) are a feature — keep.
6. Percentile stat for the talent rate widget: nightly cron computes rate percentile per role cluster.

## Leak-proof preview (non-negotiable)

The preview/unlock distinction lives **in the API response, not CSS**:
- `GET /api/slates/:id` without entitlement → masked payload: initials only, no name, no avatar key, no contact, headline generalized, no snapshot detail route access.
- Spending a credit flips the slate to unlocked → full snapshot payload.
- Snapshot detail (`/api/snapshots/:id`) 403s unless its slate is unlocked.
- Server components render from these payloads; the blur styling stays as pure decoration.

## API surface (route handlers, maps 1:1 to existing screens)

```
Auth (BetterAuth mount)        /api/auth/*
Talent   POST /api/talent/resume-upload (presign) → POST /parse → PUT /profile → POST /publish
         GET  /api/talent/dashboard | /connections | PATCH /connections/:id (consent+answers)
         GET/PUT /api/talent/rate (30-day lock) | GET /agreements | POST /outcomes/:id/confirm
Employer POST /api/jds (+AI draft endpoint) | GET /api/jds | GET /api/slates/:id (masked/full)
         POST /api/slates/:id/unlock (credit spend) | POST /api/connections (request + questions)
         GET/POST /api/agreements | POST /api/outcomes/:id/confirm | GET /api/billing
Payments POST /api/paypal/order + /capture + webhook | POST /api/paymongo/checkout + webhook
Didit    POST /api/verification/session | POST /api/webhooks/didit
Shared   /api/messages/* (poll) | /api/notifications/* | /api/reports
Admin    /api/admin/* (overview, reports actions, users, slates, re-slate)
Cron     /api/cron/digests | /api/cron/percentiles | /api/cron/reslate-check
```

## Status (Jul 19 2026)

**P0–P2 built and verified against real Neon + OpenAI.** Working end to end: signup → role → profile → rate (30-day lock enforced) → publish+embed → JD create → publish+match → locked slate → credit spend → unlock → identity released. Guards verified: 401 unauthenticated, 403 wrong role, 402 no credits, zero name leak in locked payload (`src/lib/slate.test.ts`).

Notes for whoever continues:
- Prisma 7 needs a **driver adapter** (`@prisma/adapter-pg`) — `datasourceUrl` was removed. `src/lib/db.ts` lazily constructs through a Proxy so `next build` doesn't need a live DB.
- Prisma CLI does not read `.env.local`; `prisma.config.ts` loads it explicitly.
- Matching runs inline on publish. Move to a queue before the pool outgrows the request timeout.
- Frontend pages still render mock data from `src/data/` — wiring them to these endpoints is the next task.

**P2.5 — data migrated.** 785 profiles from remotetalentph (of 1,254; the rest had neither headline nor skills), 11,318 skills, 2,911 engagements, all embedded, all **unpublished** pending the consent email. 125 implausible hourly rates dropped (source max was 50,000/hr). Scripts in `scripts/`.

Matching was then evaluated against the real pool and three defects fixed: requirement-vs-tag phrasing mismatch, a flat under-budget bonus that let a $4/hr candidate outrank better matches, and slates padding to five seats with unqualified people. See `scripts/eval-matching.ts` — re-run it after any scoring change.

**P3 — payments: BUILT BUT UNTESTED.** No live provider call has ever been made. Verified locally: all payment routes 401 unauthenticated, and forged webhooks (unsigned, claiming a completed capture) are rejected 401 with zero rows written. Both verifiers fail closed when their secret is missing.

Before taking real money, verify in sandbox:
- PayPal: order create → approve → capture returns `COMPLETED`; webhook signature verification returns `SUCCESS`; a capture arriving twice (capture route + webhook) credits **once**.
- PayMongo: `payment_intents` + `qrph` method returns a scannable code in `next_action`; a real delivery passes `verifySignature`; `qr.expired` arrives for an unpaid code.
- Confirm PayPal actually echoes `purchase_units[0].reference_id` on `PAYMENT.CAPTURE.COMPLETED` — the webhook resolves the buyer from it and falls back to `custom_id`/`invoice_id`. If none are present the delivery is logged and ignored rather than guessed at.
- Webhooks can only be registered once a public URL exists; both providers validate the endpoint at registration time.

Still stubbed: Didit (paying only creates the IdentityBinding row — the badge must come from Didit confirming identity, never from payment) and the $249/mo subscription tier.

**Remaining: P4 (relationship layer), P5 (consent email + launch).**

## Phases — each ships behind `npm run build` green + one E2E happy path

**P0 — Foundation (repo, auth, guards)**
git init; Prisma + Neon; BetterAuth (Google + credentials, email verify via Resend); proxy.ts role guards (talent/employer/admin); admin gated to an allowlist. Verify: register→verify→login→role redirect.

**P1 — Talent side real**
R2 presigned resume upload → server parse (unpdf/mammoth) → OpenAI extraction → review → publish → embed. Profile/services/rate pages live. Verify: a real PDF becomes a published, embedded profile.

**P2 — Matching + slates + preview**
JD composer with real AI draft; pipeline above; masked/full slate API; employer dashboard live. Verify: posted JD produces a slate whose preview payload contains zero PII (assert in a test, not by eye).

**P3 — Money + connections**
PayPal credits + webhook; unlock flow; connection requests w/ screening questions; consent + contact reveal + initial-instructions auto-message; PayMongo ₱60 Didit flow + badge. Verify: sandbox payment → unlock → consent → instructions land.

**P4 — Relationship layer**
Agreements (e-sign both sides, PDF to R2), outcome confirmations, double-blind ratings, messages (polling), notifications + digest cron, reports + admin actions (identity-bound bans).

**P5 — Migration + launch**
Transform script: 500+ profiles from local `shortlisted-pg` Docker DB (remotetalentph schema) → new schema as **unpublished**. Consent/re-activation email — "confirm your standing rate and availability" — publishes the profile (DPA requirement, not optional). Turnstile, Sentry, Neon PITR, lawyer pass on /terms /privacy /conduct, deploy.

## Non-goals (v1)

Escrow/salary rails · KYB · SMS anything · realtime vendor · native apps · AI support chatbot · public candidate browsing (never — it's the moat).

## Pre-existing assets to reuse

remotetalentph repo (sibling dir): magic-fill extraction prompts, questionnaire builder + response components, Didit webhook (3 signature schemes), PayPal lib, react-email templates, audit-log pattern. Migrated data: Docker `shortlisted-pg`, db `shortlisted` (1,254 profiles, 11,314 skills, 836 resumes in `uploads/`).

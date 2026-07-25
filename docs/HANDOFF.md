# Handoff — resume here

Rewritten 2026-07-26 after the **fresh-system reset**. Previous handoff content
(marketing redesign, scorer calibration, referral migration, Phase 2a) is all shipped
and superseded — git history has the details.

---

## Current state

- **Migrations are now real Prisma migrations.** Baseline:
  `prisma/migrations/20260726000000_init/migration.sql` — the entire schema plus
  everything the DSL can't express (pgvector extension, both hnsw indexes, the
  one-live-interview partial unique index, all CHECK constraints). The raw-SQL patch
  era (`scripts/add-*.sql`, `db-hardening.sql`) is over; those files are retired
  history.
  - **New schema change** = edit `prisma/schema.prisma` → `npx prisma migrate dev
    --create-only` → review/edit the SQL (hand-add any index on vector columns) →
    `npx prisma migrate dev`. **Never `prisma db push`** (drops hnsw indexes).
  - Apply to another environment: `npx prisma migrate deploy` with the right
    `DATABASE_URL`.
- **Dev DB is fresh**: schema from the baseline migration, exactly one user — the
  admin from `.env.local` `ADMIN_EMAIL` (seeded via `npm run seed:admin`). No
  profiles, no JDs, no payments. Profiles will be reloaded later
  (`scripts/migrate-profiles.ts` → `embed-profiles.ts` → `backfill-profile-tools.ts`
  is the old pipeline; revisit against audit P0-4 before rerunning).
- **Prod DB untouched** — still on the old patch-applied schema WITHOUT ProfileTool/
  tool-array columns. When ready to make prod fresh too:
  `$env:DATABASE_URL = <PROD url>; npx prisma migrate reset --force` (destructive!)
  or drop schema + `migrate deploy`, then `seed:admin`. Decide deliberately.

## The roadmap source of truth: `docs/system-audit.md`

Five-agent deep audit (employer, talent, interviewer+admin, affiliate, engine) of the
whole system, everything cited to file:line. Read it first. Top of the stack:

1. Refunds claw nothing back (credits, entitlements, referral commissions survive).
2. Referral commission silently lost when the receipt email throws (ordering in
   `fulfillPurchase`).
3. Identity verification: money taken, no Didit webhook exists, retry blocked.
4. Anti-tailoring hole: snapshot freezes at consent-accept, AFTER the candidate saw
   the must-haves — 48h tailoring window against the core product promise.
5. Slate overfill (accepts uncapped, cron invites ×3) + accepts routing to whichever
   slate is newest-approved, including already-unlocked ones.
6. Interviewer approval flips User.role and breaks the person's talent/employer
   account; no reverse lever; `requirePageUser` redirect-loops on `interviewer`.
7. `MatchElimination` write-only; `hard_filters_enabled` unsettable from admin UI;
   `ProfileTool` has no runtime writer (fresh DB starts it empty).
8. Eval harness diverges from the production pipeline — thresholds 68/55/40 were
   calibrated on the divergent one.

Full list + recommended attack order in the audit doc (P0 → P5).

## How to run things (Windows / PowerShell)

- Unit tests: `npm run test:unit` (glob now recursive — includes `src/lib/tools/`).
- Build: `npx next build`.
- Ad-hoc SQL against dev/prod: `node --experimental-strip-types scripts/db-run.ts
  <file.sql>` (`DB=prod` env for prod). For schema changes use migrations, not this.
- Seed admin: `npm run seed:admin` (reads ADMIN_EMAIL/ADMIN_PASSWORD from .env.local).
- Mailpit :8025/:1025. App :3000.

## Doc map

- `docs/system-audit.md` — THE audit + roadmap (new).
- `docs/HANDOFF.md` — this file.
- **`design.md` is referenced all over the docs but DOES NOT EXIST** — the design
  system lives only in the Tailwind tokens in `globals.css` and the primitives in
  `src/components/ui/`. Read those; write the doc or stop citing it.
- `docs/engine/engine-plan.md` + `docs/engine/eval-*.md` — engine history; recalibrate
  after audit P2-15 (harness parity) and profile reload.
- `docs/e2e-plan.md` — Playwright plan, still deferred by user choice.

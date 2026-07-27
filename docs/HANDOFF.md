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

## The roadmap source of truth: `docs/system-audit-3.md`

Three rounds of audit-and-rebuild have run. Read them NEWEST FIRST — each one
re-checks the last adversarially, and in every round a meaningful share of the
findings were bugs the PREVIOUS round introduced.

- **`docs/system-audit-3.md`** — current open list. Start here.
- `docs/system-audit-2.md` — round 2. Historical; its "NOT fixed" list was worked
  in round 3.
- `docs/system-audit.md` — round 1. Historical record of the original state.

Do not read a heading in rounds 1 or 2 as a live defect without checking the code.

## How to run things (Windows / PowerShell)

- Unit tests: `npm run test:unit` (glob now recursive — includes `src/lib/tools/`).
- Build: `npx next build`.
- Ad-hoc SQL against dev/prod: `node --experimental-strip-types scripts/db-run.ts
  <file.sql>` (`DB=prod` env for prod). For schema changes use migrations, not this.
- Seed admin: `npm run seed:admin` (reads ADMIN_EMAIL/ADMIN_PASSWORD from .env.local).
- Mailpit :8025/:1025. App :3000.

## Doc map

`docs/` contains exactly four files. Everything else previously cited here —
`design.md`, `docs/engine/engine-plan.md`, `docs/engine/eval-*.md`,
`docs/e2e-plan.md` — **does not exist**. Those citations were removed rather than
left to send the next person hunting.

- `docs/system-audit-3.md` — current open list. The roadmap.
- `docs/system-audit-2.md`, `docs/system-audit.md` — historical rounds.
- `docs/HANDOFF.md` — this file.

The design system lives in the Tailwind tokens in `globals.css` and the
primitives in `src/components/ui/`. Read those; there is no design doc.

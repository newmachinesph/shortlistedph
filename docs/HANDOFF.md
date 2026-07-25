# Handoff — resume here next day

Written 2026-07-25 at the end of a long session; updated later the same day after
the marketing redesign + admin listing control shipped. This is the single "what's
done, what's next, what to watch" doc. Read it first; deeper plans linked below.

Everything is committed and pushed to **master** (`7d4038e` at handoff). Build is
green. Working tree is clean.

---

## ~~The one thing to check before anything else~~ — RESOLVED (`686b7c2`)

**The scorer is now calibrated.** Read-only prod eval (`EVAL_DB=prod` flag added to
`scripts/eval-matching.ts`), thresholds shifted by the measured distribution move:
`MIN_SLATE_SCORE` 62 → 68, `QUALIFY_SCORE` 52 → 55, `QUALIFY_SKILLS` unchanged at 40
(bimodal around it: eligible ≥ 43, rejects ≤ 37). All fillable eval jobs keep full
slates; Amazon PPC still returns nothing. Full method + before/after tables:
`docs/engine/eval-canonical-result.md` (Follow-up 2).

---

## What shipped this session (all on master)

### Engine
- **P0 fixes** — resume prompt-injection guard (`lib/resume-guard.ts`), deterministic
  slate explanations replacing the model call (`explainMatch` in `lib/scoring.ts`),
  template heading-anchor parsing (`lib/resume-sections.ts`), `temperature: 0` on
  extraction.
- **Capacity relabel** — the employer/admin slate bar said "Timezone" but computed
  capacity; fixed on both pages.
- **Canonical tool table** (`lib/tools/aliases.ts`) — measured no-op on the current pool
  (see result doc), kept because it's correct infra for when wording variance grows.
- **Coverage-cap rework** — `SKILL_COVERAGE_DENOM = 1.5` in `lib/scoring.ts`. THE fix
  that lifted the skills ceiling: slates that returned 1–3 qualified now return 6–23.
  Un-calibrated (see top of doc).

### Frontend
- **Design tokens** — added to `globals.css` (surface ladder, type scale, radius/shadow,
  section rhythm). Brand palette unchanged.
- **7 UI primitives** — `src/components/ui/`: Button/ButtonLink, Card, Section/
  SectionHeader, StatStrip, Chip/Tag, ListingRow, EmptyState.
- **Openings board** — `/openings` (filterable demand board) + `/openings/[id]`
  (anonymized detail). Backed by `lib/openings.ts` + the leak-guard mapper in
  `lib/openings-shape.ts` (6 tests). Wired into nav, footer, sitemap.
- **`design.md`** — the locked design system every page redesign reads.
- **Homepage redesigned** on the system (`app/page.tsx`) — the exemplar every other
  marketing page follows.
- **Showcase avatars** — real talent photos on the homepage, faces-only, behind the
  `showcase_avatars` admin switch.

### Database (both dev + prod, verified)
- `TalentProfile.flags` column (injection review signal).
- `JobDescription` openings columns: `publicTitle`, `roleFamily`, `industry`,
  `clientRegion`, `listedAt` + index.
- Both applied via **raw SQL** (`scripts/add-*.sql`), NOT `prisma db push` — push drops
  the hnsw indexes. Both hnsw indexes verified intact on each database.

---

## Next steps, in priority order

### ~~1. Finish the marketing redesign~~ — DONE (`430ec4d`)
`for-employers`, `for-talent`, `why-it-works`, `pricing`, `resume-template`, and the
legal pages (`terms`/`privacy`/`conduct`) now compose the 7 primitives under `design.md`.
Copy, schema and data unchanged; visual layer only, like the homepage.

### ~~2. Admin "List publicly" control~~ — DONE (`7d4038e`)
`ListPubliclyForm` on the admin slate-review screen + `POST /api/admin/openings`:
suggested `publicTitle` (prefilled from the employer title — the admin edit IS the
sanitization step), `roleFamily`/`clientRegion` selects from `lib/openings-taxonomy.ts`,
free-text industry, publish/unlist stamping or clearing `listedAt` (first-publish date
preserved on later edits). Board still fails closed without `publicTitle` + `listedAt`.

### ~~1. Scorer calibration~~ — DONE (`686b7c2`, see the resolved note at the top)

### 1. E2E harness (not started)
Fully planned in `docs/e2e-plan.md`. Playwright + real Postgres + Mailpit, no real emails.
Build J7 (public-route smoke) first — it becomes the redesign regression net.

---

## How to run things (Windows / PowerShell)

- **Unit tests:** `npm run test:unit` (or `node --experimental-strip-types src/lib/X.test.ts`)
- **Build:** `npx next build`
- **Apply a migration to a DB:** `node node_modules/prisma/build/index.js db execute --file scripts/<name>.sql`
  (prod: set `$env:DATABASE_URL` to the `PROD_DATABASE_URL` value from `.env.local` first).
  **Never `prisma db push`** — it drops the hnsw indexes.
- **Prod eval (read-only):** point `scripts/eval-matching.ts` at `PROD_DATABASE_URL`
  (its default `.env.local` override loads the 2-profile dev DB, which tells you nothing).
- Mailpit runs on :8025 (API) / :1025 (SMTP). App on :3000.

---

## Doc map

- `docs/HANDOFF.md` — this file.
- `docs/redesign-plan.md` — the marketing redesign plan (scope, openings board §3).
- `design.md` — the LOCKED design system. Every page redesign reads it.
- `docs/engine/gap-analysis.md` — spec vs shipped code, every gap cited to a line.
- `docs/engine/engine-plan.md` — the engine roadmap + phase status.
- `docs/engine/eval-baseline.md` — the pre-change scorer baseline (785-profile prod pool).
- `docs/engine/eval-canonical-result.md` — the measured canonical no-op + coverage-rework win.
- `docs/e2e-plan.md` — the end-to-end test plan (Playwright + Mailpit, no real emails).

---

## Branches

- **master** — everything, live. `763aa0c` at handoff.
- **feat/redesign-foundation** — merged into master; remote tip is stale (`b234fbf`), safe
  to ignore or delete. New work branches fresh off master.

# PROJECT.md — current status

Updated 2026-07-26.

- **Fresh system.** Dev DB rebuilt from the Prisma baseline migration
  (`prisma/migrations/20260726000000_init/`), seeded with only the admin account.
  Profiles/JDs/payments intentionally empty — pool reload comes later
  (`migrate-profiles.ts` → `embed-profiles.ts` → `backfill-profile-tools.ts`).
- **Prod NOT reset** — still on the old patch-era schema. Resetting it is an explicit
  human decision.
- **Schema changes = Prisma migrations** (`migrate dev --create-only` → review SQL →
  apply). `prisma db push` is banned — it drops the hnsw indexes.
- **Roadmap = `docs/system-audit.md`** (P0 money fixes → role model → snapshot timing →
  reload profiles → recalibrate engine). Work top-down from P0.
- Engine thresholds (68/55/40) are suspect: calibrated on an eval harness that diverges
  from the production pipeline (audit P2-15). Recalibrate after harness parity + reload.
- E2E harness (docs/e2e-plan.md) deferred by user choice.

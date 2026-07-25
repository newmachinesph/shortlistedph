# PROJECT.md — current status

Updated 2026-07-26.

- **Fresh system.** Dev DB rebuilt from the Prisma migration chain
  (`prisma/migrations/`), seeded with only the admin account. Profiles/JDs/
  payments intentionally empty — pool reload comes later
  (`migrate-profiles.ts` → `embed-profiles.ts`; ProfileTool now has a runtime
  writer so no backfill is needed for new profiles).
- **Prod NOT reset** — still on the old patch-era schema, and it has none of the
  round-1 migrations. Bringing it up is an explicit human decision.
- **Schema changes = Prisma migrations.** `migrate dev --create-only` → **delete
  the two hnsw DROP INDEX lines it always emits** → apply. `db push` is banned.
  Migration folder names must sort in apply order (see MISTAKES.md).
- **Round 1 rebuild shipped** (`32e8fce`): the whole of `docs/system-audit.md`
  P0–P5, across six parallel surfaces plus the core. Headlines: ranking freezes
  at invite so anti-tailoring is literal; refunds claw back credits and void
  commissions; interview credits are ledgered and cancellable; verification is a
  reviewed decision; interviewing is a capability, not a role; the eval harness
  ranks through the production path.
- **Round 2 audit** re-checks all of it adversarially → `docs/system-audit-2.md`.
  Work that doc top-down; it supersedes round 1's list.
- Engine thresholds (68/55/40) were re-verified against production data through
  the now-parity harness and did not move.
- E2E harness (docs/e2e-plan.md) still deferred by user choice.

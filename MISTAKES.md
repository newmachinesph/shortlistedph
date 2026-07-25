# MISTAKES.md — pitfalls to not repeat

- **Never `prisma db push`** — silently drops the hnsw vector indexes. Migrations only.
- **Every generated migration tries to drop the hnsw indexes.** Prisma cannot see
  indexes on `Unsupported("vector")` columns, so each `migrate dev --create-only`
  emits `DROP INDEX jd_embedding_hnsw` + `talent_embedding_hnsw` as "drift". Delete
  those two lines by hand, every single time, before applying. Verify after with a
  query on `pg_indexes`.
- **Never hand-name a migration folder with a future timestamp.** Prisma names them in
  UTC and replays the whole chain in *filename order* against a shadow database on the
  next `migrate dev`. A hand-picked name that sorts after the clock makes later
  migrations replay before the tables exist ("relation X does not exist"), and the
  error points at the wrong migration entirely.
- **Don't trust the eval harness as-is** — it ranks a different pipeline than
  production (pool gates, verified bonus, rotation all differ). Fix parity before
  trusting any threshold it produces (audit P2-15).
- **Two writers, one side effect**: `availability` via profile PATCH skips the
  `availabilityConfirmedAt` stamp the dedicated route sets. When adding a writer,
  grep the existing one for side effects first.
- **Swallowed try/catch around money**: commission accrual was silently lost when the
  receipt email threw first (audit P0-2). Money operations get their own error
  handling, never share a catch with cosmetics.
- **Unconditional role flips break accounts** — interviewer approval sets `User.role`
  and strands the person's talent/employer surface (audit P0-8).
- **Copy ships promises code doesn't keep** (re-slate guarantee, hiring desk,
  auto-verification). Before writing marketing/UI copy, verify the code path exists.
- **Write-only tables rot** — MatchElimination, ProfileTool. A new table needs its
  reader and its runtime writer in the same phase, or a dated TODO naming the phase.
- **Backfills are not sync** — a backfill script covers the pool once; without a
  runtime writer the table drifts stale immediately.

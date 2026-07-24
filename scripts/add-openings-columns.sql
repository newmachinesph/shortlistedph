-- Public openings board columns on JobDescription (docs/redesign-plan.md §3).
--
-- Additive and nullable — no backfill, no existing row changes. Applied as raw
-- SQL rather than `prisma db push`, because push does not know about the hnsw
-- indexes db-hardening.sql created and would DROP them. Same discipline as
-- scripts/add-talent-flags.sql.
--
-- Idempotent. Apply on each database with:
--   node node_modules/prisma/build/index.js db execute --file scripts/add-openings-columns.sql
-- then verify the two hnsw indexes survived (scripts/verify-talent-flags.sql
-- covers that check).

ALTER TABLE "JobDescription"
  ADD COLUMN IF NOT EXISTS "publicTitle"  TEXT,
  ADD COLUMN IF NOT EXISTS "roleFamily"   TEXT,
  ADD COLUMN IF NOT EXISTS "industry"     TEXT,
  ADD COLUMN IF NOT EXISTS "clientRegion" TEXT,
  ADD COLUMN IF NOT EXISTS "listedAt"     TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "JobDescription_listedAt_idx" ON "JobDescription" ("listedAt");

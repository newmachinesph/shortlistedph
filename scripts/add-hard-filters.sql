-- Stage 0 hard filters (engine-plan 1c): hardRequirements on JobDescription +
-- the MatchElimination log. Additive and nullable — no existing row changes,
-- and the hard_filters_enabled AppSetting stays off until flipped, so
-- behaviour is unchanged on deploy.
--
-- Raw SQL, never `prisma db push` — push drops the hnsw indexes. Idempotent.
-- Apply with:
--   node node_modules/prisma/build/index.js db execute --file scripts/add-hard-filters.sql

ALTER TABLE "JobDescription"
  ADD COLUMN IF NOT EXISTS "hardRequirements" JSONB;

CREATE TABLE IF NOT EXISTS "MatchElimination" (
  "id"        TEXT NOT NULL,
  "jdId"      TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "reason"    TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MatchElimination_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MatchElimination_jdId_fkey" FOREIGN KEY ("jdId")
    REFERENCES "JobDescription" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "MatchElimination_jdId_reason_idx"
  ON "MatchElimination" ("jdId", "reason");

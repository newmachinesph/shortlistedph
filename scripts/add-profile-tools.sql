-- Engine Phase 2a: ProfileTool table + JobDescription canonical tool arrays.
--
-- ProfileTool holds one row per (profile, canonical tool) the alias table
-- recognises (src/lib/tools/aliases.ts). Skill stays as provenance and what
-- the scorer reads today; ProfileTool feeds Phase 3 modifiers.
-- requiredTools/preferredTools are canonical IDs mapped from the employer's
-- must/nice-to-haves at JD save; unmapped requirements stay prose.
--
-- Applied as raw SQL, never `prisma db push` — push drops the hnsw indexes.
-- Idempotent. Apply with:
--   node --experimental-strip-types scripts/db-run.ts scripts/add-profile-tools.sql
--   DB=prod node --experimental-strip-types scripts/db-run.ts scripts/add-profile-tools.sql
-- then backfill with scripts/backfill-profile-tools.ts (same DB= selection).

CREATE TABLE IF NOT EXISTS "ProfileTool" (
  "id"           TEXT NOT NULL,
  "profileId"    TEXT NOT NULL,
  "canonicalId"  TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "years"        INTEGER,
  "lastUsedYear" INTEGER,
  "category"     TEXT,

  CONSTRAINT "ProfileTool_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProfileTool_profileId_fkey" FOREIGN KEY ("profileId")
    REFERENCES "TalentProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProfileTool_profileId_canonicalId_key"
  ON "ProfileTool" ("profileId", "canonicalId");
CREATE INDEX IF NOT EXISTS "ProfileTool_canonicalId_idx"
  ON "ProfileTool" ("canonicalId");

ALTER TABLE "JobDescription"
  ADD COLUMN IF NOT EXISTS "requiredTools"  TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "preferredTools" TEXT[] NOT NULL DEFAULT '{}';

-- TalentProfile.flags — extraction review signals (lib/resume-guard.ts).
--
-- Applied as raw SQL rather than `prisma db push`, because push does not know
-- about the hnsw indexes created by db-hardening.sql and would DROP them:
--
--   DROP INDEX "jd_embedding_hnsw";
--   DROP INDEX "talent_embedding_hnsw";
--
-- Losing those silently degrades every match query. Any additive schema change
-- on this database should go the same way: raw ALTER here, then prisma generate.
--
-- Idempotent. Run on prod with the same command:
--   node node_modules/prisma/build/index.js db execute --file scripts/add-talent-flags.sql --schema prisma/schema.prisma

ALTER TABLE "TalentProfile"
  ADD COLUMN IF NOT EXISTS "flags" TEXT[] DEFAULT ARRAY[]::TEXT[];

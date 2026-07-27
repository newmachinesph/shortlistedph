-- Split self-reported committed hours from the derived total.
--
-- committedHours becomes "self-reported + every confirmed engagement", and is
-- still the one number scoreOverlap, the Stage 0 hours filter and the
-- preferences facet read. selfCommittedHours preserves the talent's own answer
-- so recomputing the total cannot erase it — they may be working somewhere this
-- platform will never hear about.
--
-- Backfilled from the existing column: today every value in committedHours was
-- typed by the talent (nothing else has ever written it), so that is exactly
-- what the self-reported baseline should start as.
--
-- NOTE: Prisma's differ emitted `DROP INDEX jd_embedding_hnsw` and
-- `DROP INDEX talent_embedding_hnsw` into this file, as it does into every
-- migration it generates, because it cannot see pgvector index types. Both
-- lines were removed by hand. See MISTAKES.md.

ALTER TABLE "TalentProfile" ADD COLUMN "selfCommittedHours" INTEGER NOT NULL DEFAULT 0;

UPDATE "TalentProfile" SET "selfCommittedHours" = "committedHours";

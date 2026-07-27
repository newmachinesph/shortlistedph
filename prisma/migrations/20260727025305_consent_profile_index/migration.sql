-- Rotation now reads invite counts per profile on every ranking run
-- (compareRotation in lib/scoring.ts). The existing @@unique([jdId, profileId])
-- leads on jdId and cannot serve a per-profile aggregate.
--
-- NOTE: the generated diff again wanted to DROP talent_embedding_hnsw and
-- jd_embedding_hnsw — Prisma cannot see indexes on Unsupported("vector")
-- columns and reads them as drift. Deleted by hand. Check every migration.

CREATE INDEX "MatchConsent_profileId_idx" ON "MatchConsent"("profileId");

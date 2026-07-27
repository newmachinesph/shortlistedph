-- Park a consent whose delivery keeps failing.
--
-- sendConsentRequests took the oldest unsent consents first, so one permanently
-- undeliverable address was re-picked every hour, held the slate slot, and
-- still counted against the JD's SLATE_SIZE * 3 consent cap — the JD reached
-- "pool exhausted" having delivered zero emails.
--
-- NOTE: the generated diff again wanted to DROP talent_embedding_hnsw and
-- jd_embedding_hnsw — Prisma cannot see indexes on Unsupported("vector")
-- columns and reads them as drift. Deleted by hand. Check every migration.

ALTER TABLE "MatchConsent" ADD COLUMN "sendAttempts" INTEGER NOT NULL DEFAULT 0;

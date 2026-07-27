-- STOPGAP: withdraw the imported remotetalentph pool from matching until each
-- person has actually consented.
--
-- Why this exists
-- ---------------
-- scripts/migrate-profiles.ts imports these profiles UNPUBLISHED on purpose —
-- its own header calls publishing them "the consent violation the whole
-- platform is supposed to stand against", and scripts/embed-profiles.ts
-- repeats the reasoning. Nothing in the codebase publishes them.
--
-- Production nevertheless has ~785 published, matchable migrated profiles.
-- They were published outside the code. Until the re-activation flow has
-- actually been sent and answered, none of those people has agreed to appear
-- in front of an employer on this platform.
--
-- What it does
-- ------------
-- Clears publishedAt for imported profiles that have never been re-activated.
-- It deliberately does NOT touch:
--   * profiles with no legacyId — people who signed up to shortlisted.ph
--     directly and published themselves;
--   * profiles with reactivatedAt set — they came back and chose.
--
-- Embeddings, skills, engagements and the rows themselves are untouched, so
-- this is fully reversible: re-activation sets publishedAt again, per person,
-- with their consent.
--
-- Run:
--   DB=prod node --experimental-strip-types scripts/db-run.ts scripts/unpublish-migrated-pool.sql
--
-- Check first (read-only):
--   SELECT count(*) FROM "TalentProfile"
--    WHERE "legacyId" IS NOT NULL AND "publishedAt" IS NOT NULL
--      AND "reactivatedAt" IS NULL;

UPDATE "TalentProfile"
   SET "publishedAt" = NULL
 WHERE "legacyId" IS NOT NULL
   AND "publishedAt" IS NOT NULL
   AND "reactivatedAt" IS NULL;

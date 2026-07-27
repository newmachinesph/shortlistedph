-- Wipe a database's public schema so the Prisma migration chain can rebuild it
-- from zero.
--
-- DESTRUCTIVE AND IRREVERSIBLE. Every table, row, index and constraint in the
-- public schema is dropped. There is no undo and no backup taken here.
--
-- Intended for exactly two cases:
--   * resetting the dev database;
--   * the one-time prod reset that put prod onto the migration chain, starting
--     with zero jobseekers (see PROJECT.md).
--
-- Run, then IMMEDIATELY rebuild — a database left in this state has no schema:
--   node --experimental-strip-types scripts/db-run.ts scripts/reset-schema.sql
--   npx prisma migrate deploy
--   npm run seed:admin
--
-- For prod, prefix with DB=prod and set DATABASE_URL to the prod URL for the
-- migrate/seed steps. Verify afterwards that both hnsw indexes,
-- interview_one_live_per_entry and all 17 CHECK constraints came back —
-- Prisma's differ cannot see any of them, so a silent loss is possible.

DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

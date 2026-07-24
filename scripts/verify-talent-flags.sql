-- Post-migration check for scripts/add-talent-flags.sql.
--
-- Raises an exception if anything is wrong, so `prisma db execute` reports a
-- clear failure instead of printing rows you would have to read. Success looks
-- like "Script executed successfully."
--
-- Checks both halves of the risk: that the column landed, and that neither hnsw
-- index was dropped along the way (which is what `prisma db push` would do).

DO $$
DECLARE
  col_count int;
  idx_count int;
BEGIN
  SELECT count(*) INTO col_count
    FROM information_schema.columns
   WHERE table_name = 'TalentProfile' AND column_name = 'flags';

  SELECT count(*) INTO idx_count
    FROM pg_indexes
   WHERE indexname IN ('talent_embedding_hnsw', 'jd_embedding_hnsw');

  IF col_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: TalentProfile.flags is missing — the migration did not apply';
  END IF;

  IF idx_count <> 2 THEN
    RAISE EXCEPTION
      'FAIL: expected 2 hnsw indexes, found % — recreate them from scripts/db-hardening.sql',
      idx_count;
  END IF;

  RAISE NOTICE 'OK: TalentProfile.flags present, both hnsw indexes intact';
END $$;

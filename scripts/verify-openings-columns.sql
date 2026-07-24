-- Post-migration check for scripts/add-openings-columns.sql.
-- Raises an exception on any problem, so `prisma db execute` reports a clear
-- failure instead of rows to eyeball. Success = "Script executed successfully."
--
-- Checks both halves of the risk: the five columns landed, and neither hnsw
-- index was dropped (which is what `prisma db push` would do).

DO $$
DECLARE
  col_count int;
  idx_count int;
BEGIN
  SELECT count(*) INTO col_count
    FROM information_schema.columns
   WHERE table_name = 'JobDescription'
     AND column_name IN ('publicTitle', 'roleFamily', 'industry', 'clientRegion', 'listedAt');

  SELECT count(*) INTO idx_count
    FROM pg_indexes
   WHERE indexname IN ('talent_embedding_hnsw', 'jd_embedding_hnsw');

  IF col_count <> 5 THEN
    RAISE EXCEPTION 'FAIL: expected 5 openings columns on JobDescription, found %', col_count;
  END IF;

  IF idx_count <> 2 THEN
    RAISE EXCEPTION
      'FAIL: expected 2 hnsw indexes, found % — recreate them from scripts/db-hardening.sql',
      idx_count;
  END IF;

  RAISE NOTICE 'OK: 5 openings columns present, both hnsw indexes intact';
END $$;

-- Post-migration check for scripts/add-referral-commissions.sql.
-- Run with:
--   node node_modules/prisma/build/index.js db execute --file scripts/verify-referral-commissions.sql
-- All three assertions raise on failure; silence is a pass.

DO $$
DECLARE
  missing INT;
  hnsw_count INT;
BEGIN
  -- 1. Every qualified conversion has a commission row (balance preserved).
  SELECT count(*) INTO missing
  FROM "ReferralConversion" c
  WHERE c."status" = 'qualified'
    AND NOT EXISTS (
      SELECT 1 FROM "ReferralCommission" m WHERE m."conversionId" = c."id"
    );
  IF missing > 0 THEN
    RAISE EXCEPTION 'backfill incomplete: % qualified conversions without a commission', missing;
  END IF;

  -- 2. The unique index that makes webhook replays safe exists.
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ReferralCommission' AND indexname = 'ReferralCommission_paymentId_key'
  ) THEN
    RAISE EXCEPTION 'ReferralCommission_paymentId_key is missing';
  END IF;

  -- 3. The hnsw indexes survived (the reason these migrations are raw SQL).
  SELECT count(*) INTO hnsw_count FROM pg_indexes
  WHERE indexdef ILIKE '%hnsw%';
  IF hnsw_count < 2 THEN
    RAISE EXCEPTION 'expected >= 2 hnsw indexes, found %', hnsw_count;
  END IF;
END $$;

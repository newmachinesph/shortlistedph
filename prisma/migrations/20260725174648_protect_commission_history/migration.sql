-- Money history must survive a user deletion.
--
-- user → conversion → commission all cascaded, so deleting a referred user
-- silently destroyed commissions that were already inside a PAID payout,
-- leaving an affiliate's "earned" below their "paid" with no audit trace.
-- Restrict makes any future delete path deal with the money explicitly.
--
-- NOTE: the generated diff again wanted to DROP talent_embedding_hnsw and
-- jd_embedding_hnsw — Prisma cannot see indexes on Unsupported("vector")
-- columns and reads them as drift. Deleted by hand. Check every migration.

ALTER TABLE "ReferralCommission" DROP CONSTRAINT "ReferralCommission_conversionId_fkey";

ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_conversionId_fkey"
  FOREIGN KEY ("conversionId") REFERENCES "ReferralConversion"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

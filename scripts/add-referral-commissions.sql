-- Recurring affiliate commissions: one row per qualifying purchase.
--
-- ReferralConversion stays as the attribution row (who referred whom, once);
-- money moves into ReferralCommission, which accrues $9 on EVERY
-- shortlist-credit purchase by a referred company, for the lifetime of that
-- company. paymentId (the provider reference) is unique so a replayed webhook
-- can never pay twice.
--
-- Backfill: every existing qualified conversion becomes exactly one commission
-- carrying its historical amount (the old $9.99 one-time bounty) and its
-- payout linkage, so no affiliate's earned/owed/paid balance changes.
--
-- Applied as raw SQL, never `prisma db push` — push drops the hnsw indexes
-- (see scripts/db-hardening.sql). Idempotent. Apply with:
--   node node_modules/prisma/build/index.js db execute --file scripts/add-referral-commissions.sql
-- then run scripts/verify-referral-commissions.sql.

CREATE TABLE IF NOT EXISTS "ReferralCommission" (
  "id"           TEXT NOT NULL,
  "referralId"   TEXT NOT NULL,
  "conversionId" TEXT NOT NULL,
  "paymentId"    TEXT NOT NULL,
  "amount"       DECIMAL(10,2) NOT NULL,
  "currency"     TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "payoutId"     TEXT,

  CONSTRAINT "ReferralCommission_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReferralCommission_referralId_fkey" FOREIGN KEY ("referralId")
    REFERENCES "Referral" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReferralCommission_conversionId_fkey" FOREIGN KEY ("conversionId")
    REFERENCES "ReferralConversion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReferralCommission_payoutId_fkey" FOREIGN KEY ("payoutId")
    REFERENCES "ReferralPayout" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ReferralCommission_paymentId_key"
  ON "ReferralCommission" ("paymentId");
CREATE INDEX IF NOT EXISTS "ReferralCommission_referralId_payoutId_idx"
  ON "ReferralCommission" ("referralId", "payoutId");
CREATE INDEX IF NOT EXISTS "ReferralCommission_conversionId_idx"
  ON "ReferralCommission" ("conversionId");

-- Backfill from qualified conversions. Old rows may predate paymentId, so the
-- conversion id doubles as a synthetic reference. ON CONFLICT makes a re-run a
-- no-op.
INSERT INTO "ReferralCommission"
  ("id", "referralId", "conversionId", "paymentId", "amount", "currency", "createdAt", "payoutId")
SELECT
  'rcm_' || c."id",
  c."referralId",
  c."id",
  COALESCE(c."paymentId", 'legacy-' || c."id"),
  COALESCE(c."rewardAmount", 9.99),
  COALESCE(c."currency", 'USD'),
  COALESCE(c."qualifiedAt", c."createdAt"),
  c."payoutId"
FROM "ReferralConversion" c
WHERE c."status" = 'qualified'
ON CONFLICT ("paymentId") DO NOTHING;

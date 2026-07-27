-- Partial refunds.
--
-- Both providers can hand back less than the whole purchase, and every refund
-- event was being treated as the whole thing: one credit refunded out of five
-- revoked all five. refundedAmount is the running total actually returned;
-- refundRefs is the set of provider refund ids already applied — Payment's
-- unique providerRef makes the CAPTURE idempotent but says nothing about
-- refunds, of which one payment can have many.
--
-- NOTE: Prisma's differ emitted `DROP INDEX jd_embedding_hnsw` and
-- `DROP INDEX talent_embedding_hnsw` into this file, as it does into every
-- migration it generates, because it cannot see pgvector index types. Both
-- lines were removed by hand. See MISTAKES.md.

ALTER TABLE "Payment" ADD COLUMN "refundRefs" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "refundedAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;

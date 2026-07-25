-- P0 fixes from docs/system-audit.md.
--
-- NOTE: `prisma migrate dev --create-only` generated DROP INDEX statements for
-- talent_embedding_hnsw / jd_embedding_hnsw — the diff cannot see indexes on
-- Unsupported("vector") columns and reads them as drift. They were deleted by
-- hand. EVERY future migration must be reviewed for the same two lines.

-- ── Invite-time freeze (audit P0-4, P2-16) ───────────────────────────────
-- The consent row now carries the ranking: snapshot, score, dims and reasons
-- are computed once, at invite, before the candidate is shown the must-haves.
-- Accept copies them onto the slate instead of re-scoring after disclosure.
ALTER TABLE "MatchConsent" ADD COLUMN     "dims" JSONB,
ADD COLUMN     "reasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "score" INTEGER,
ADD COLUMN     "slateId" TEXT,
ADD COLUMN     "snapshotId" TEXT;

CREATE INDEX "MatchConsent_slateId_status_idx" ON "MatchConsent"("slateId", "status");

ALTER TABLE "MatchConsent" ADD CONSTRAINT "MatchConsent_slateId_fkey" FOREIGN KEY ("slateId") REFERENCES "Slate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchConsent" ADD CONSTRAINT "MatchConsent_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "ProfileSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Credit ledger completeness (audit P0-1, P0-6) ────────────────────────
-- Interview spends and refund/deduction revocations now leave a row, so
-- count(unspent, unrevoked) can be reconciled against the balance.
ALTER TABLE "Entitlement" ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "revokedReason" TEXT,
ADD COLUMN     "spentOnInterviewId" TEXT;

CREATE INDEX "Entitlement_employerId_kind_revokedAt_idx" ON "Entitlement"("employerId", "kind", "revokedAt");
CREATE INDEX "Entitlement_source_idx" ON "Entitlement"("source");

-- ── Refund trail (audit P0-1) ────────────────────────────────────────────
ALTER TABLE "Payment" ADD COLUMN "refundedAt" TIMESTAMP(3);

ALTER TABLE "ReferralCommission" ADD COLUMN     "voidedAt" TIMESTAMP(3),
ADD COLUMN     "voidedReason" TEXT;

-- ── Verification is reviewed, not bought (audit P0-3) ────────────────────
ALTER TABLE "IdentityBinding" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'pending';

CREATE INDEX "IdentityBinding_status_idx" ON "IdentityBinding"("status");

ALTER TABLE "IdentityBinding" ADD CONSTRAINT identity_binding_status_check
  CHECK (status IN ('pending', 'verified', 'rejected'));

-- ── Employers can close a role (audit P1-12) ─────────────────────────────
ALTER TABLE "JobDescription" ADD COLUMN "closedAt" TIMESTAMP(3);

-- ── Interviewing is a capability, not a role (audit P0-8) ────────────────
-- Approval no longer rewrites User.role; the Interviewer row is the gate, and
-- it can now be revoked.
ALTER TABLE "Interviewer" DROP CONSTRAINT IF EXISTS interviewer_status_check;
ALTER TABLE "Interviewer" ADD CONSTRAINT interviewer_status_check
  CHECK (status IN ('pending', 'active', 'paused', 'revoked'));

UPDATE "user" SET role = 'talent' WHERE role = 'interviewer';

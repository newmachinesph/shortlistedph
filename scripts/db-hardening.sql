-- DB hardening that Prisma's schema DSL cannot express.
-- Idempotent — safe to re-run. Apply with:
--   npm run db:harden          (uses DATABASE_URL from .env)
-- Run against production the same way you run prisma db push there
-- (temporary DATABASE_URL override).

-- ─── ANN vector indexes ──────────────────────────────────────────────────
-- Without these, every match request computes cosine distance against the
-- whole published pool (O(n) per JD publish). hnsw needs no training step
-- and stays accurate as the table grows.
CREATE INDEX IF NOT EXISTS talent_embedding_hnsw
  ON "TalentProfile" USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS jd_embedding_hnsw
  ON "JobDescription" USING hnsw (embedding vector_cosine_ops);

-- ─── CHECK constraints on status-like String columns ─────────────────────
-- The schema documents these value sets in comments only; a CHECK makes the
-- database reject a typo'd status from any future script or manual fix.
-- Value sets confirmed against every write site in src/ (2026-07-23).

ALTER TABLE "user" DROP CONSTRAINT IF EXISTS user_status_check;
ALTER TABLE "user" ADD CONSTRAINT user_status_check
  CHECK (status IN ('active', 'suspended', 'banned'));

ALTER TABLE "user" DROP CONSTRAINT IF EXISTS user_role_check;
ALTER TABLE "user" ADD CONSTRAINT user_role_check
  CHECK (role IN ('talent', 'employer', 'admin', 'interviewer'));

ALTER TABLE "TalentProfile" DROP CONSTRAINT IF EXISTS talent_availability_check;
ALTER TABLE "TalentProfile" ADD CONSTRAINT talent_availability_check
  CHECK (availability IN ('open', 'partial', 'booked'));

ALTER TABLE "TalentProfile" DROP CONSTRAINT IF EXISTS talent_verified_tier_check;
ALTER TABLE "TalentProfile" ADD CONSTRAINT talent_verified_tier_check
  CHECK ("verifiedTier" IN ('none', 'id_verified'));

ALTER TABLE "JobDescription" DROP CONSTRAINT IF EXISTS jd_status_check;
ALTER TABLE "JobDescription" ADD CONSTRAINT jd_status_check
  CHECK (status IN ('draft', 'matching', 'rematching', 'slate_ready', 'no_matches', 'failed', 'closed'));

ALTER TABLE "Slate" DROP CONSTRAINT IF EXISTS slate_status_check;
ALTER TABLE "Slate" ADD CONSTRAINT slate_status_check
  CHECK (status IN ('preview', 'unlocked'));

ALTER TABLE "Connection" DROP CONSTRAINT IF EXISTS connection_state_check;
ALTER TABLE "Connection" ADD CONSTRAINT connection_state_check
  CHECK (state IN ('requested', 'consented', 'declined', 'expired'));

ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS payment_status_check;
ALTER TABLE "Payment" ADD CONSTRAINT payment_status_check
  CHECK (status IN ('pending', 'paid', 'failed', 'refunded'));

ALTER TABLE "Interview" DROP CONSTRAINT IF EXISTS interview_status_check;
ALTER TABLE "Interview" ADD CONSTRAINT interview_status_check
  CHECK (status IN ('requested', 'consented', 'paid', 'scheduled', 'recorded', 'reported', 'declined', 'cancelled'));

ALTER TABLE "Interviewer" DROP CONSTRAINT IF EXISTS interviewer_status_check;
ALTER TABLE "Interviewer" ADD CONSTRAINT interviewer_status_check
  CHECK (status IN ('pending', 'active', 'paused'));

ALTER TABLE "ReferralConversion" DROP CONSTRAINT IF EXISTS referral_conversion_status_check;
ALTER TABLE "ReferralConversion" ADD CONSTRAINT referral_conversion_status_check
  CHECK (status IN ('signed_up', 'qualified', 'void'));

ALTER TABLE "ReferralPayout" DROP CONSTRAINT IF EXISTS referral_payout_status_check;
ALTER TABLE "ReferralPayout" ADD CONSTRAINT referral_payout_status_check
  CHECK (status IN ('pending', 'paid', 'rejected'));

ALTER TABLE "InterviewerPayout" DROP CONSTRAINT IF EXISTS interviewer_payout_status_check;
ALTER TABLE "InterviewerPayout" ADD CONSTRAINT interviewer_payout_status_check
  CHECK (status IN ('pending', 'paid', 'rejected'));

-- Nothing may cascade away delivered product or money history.
--
-- 1. THE SNAPSHOT IS THE PRODUCT. user → TalentProfile → ProfileSnapshot →
--    SlateEntry → {Connection, Agreement, Rating, OutcomeConfirmation,
--    Interview, InterviewAssessment} was Cascade the whole way, so deleting one
--    talent profile destroyed an employer's paid shortlist, the agreements
--    signed off it, and reported interviews an interviewer was still owed for.
--    Restricting the two ProfileSnapshot parents (and Slate → JobDescription)
--    stops the chain at its head: everything downstream keeps its Cascade and
--    is simply unreachable. Interview.employerId/talentUserId are restricted
--    too — they are edges into the same rows that bypass the snapshot.
--
-- 2. Entitlement.spentOnSlateId / spentOnInterviewId had NO foreign key, so a
--    credit could stay marked spent while its target was gone. Reconciliation
--    then reported drift 0 on a ledger nobody could audit. RESTRICT, because a
--    spent credit is the receipt for the thing it points at.
--
-- 3. Payment and ReferralPayout cascaded from `user`: deleting an affiliate
--    destroyed their PAID payouts, and the SetNull on
--    ReferralCommission.payoutId then made every commission those payouts had
--    settled read as owed again. 20260725174648 guarded the conversion edge and
--    missed both of these, plus the shorter Referral → ReferralCommission route.
--
-- 4. CHECK constraints at the bottom: credits >= 0 lived in five app guards and
--    zero constraints, and an out-of-set Entitlement.kind dropped out of the
--    reconciliation GROUP BY instead of showing up as drift.
--
-- NOTE: the generated diff again wanted to DROP talent_embedding_hnsw and
-- jd_embedding_hnsw — Prisma cannot see indexes on Unsupported("vector")
-- columns and reads them as drift. Deleted by hand. Check every migration.
-- The same blindness applies to interview_one_live_per_entry (a PARTIAL unique
-- index) and to every CHECK constraint, including the two added below.

-- DropForeignKey
ALTER TABLE "Entitlement" DROP CONSTRAINT "Entitlement_employerId_fkey";

-- DropForeignKey
ALTER TABLE "Interview" DROP CONSTRAINT "Interview_employerId_fkey";

-- DropForeignKey
ALTER TABLE "Interview" DROP CONSTRAINT "Interview_talentUserId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_userId_fkey";

-- DropForeignKey
ALTER TABLE "ProfileSnapshot" DROP CONSTRAINT "ProfileSnapshot_jdId_fkey";

-- DropForeignKey
ALTER TABLE "ProfileSnapshot" DROP CONSTRAINT "ProfileSnapshot_profileId_fkey";

-- DropForeignKey
ALTER TABLE "ReferralCommission" DROP CONSTRAINT "ReferralCommission_referralId_fkey";

-- DropForeignKey
ALTER TABLE "ReferralPayout" DROP CONSTRAINT "ReferralPayout_userId_fkey";

-- DropForeignKey
ALTER TABLE "Slate" DROP CONSTRAINT "Slate_jdId_fkey";

-- CreateIndex
CREATE INDEX "Entitlement_spentOnSlateId_idx" ON "Entitlement"("spentOnSlateId");

-- CreateIndex
CREATE INDEX "Entitlement_spentOnInterviewId_idx" ON "Entitlement"("spentOnInterviewId");

-- AddForeignKey
ALTER TABLE "ProfileSnapshot" ADD CONSTRAINT "ProfileSnapshot_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TalentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileSnapshot" ADD CONSTRAINT "ProfileSnapshot_jdId_fkey" FOREIGN KEY ("jdId") REFERENCES "JobDescription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Slate" ADD CONSTRAINT "Slate_jdId_fkey" FOREIGN KEY ("jdId") REFERENCES "JobDescription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "EmployerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_spentOnSlateId_fkey" FOREIGN KEY ("spentOnSlateId") REFERENCES "Slate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_spentOnInterviewId_fkey" FOREIGN KEY ("spentOnInterviewId") REFERENCES "Interview"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralPayout" ADD CONSTRAINT "ReferralPayout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "EmployerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_talentUserId_fkey" FOREIGN KEY ("talentUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Invariants the app was carrying alone (Prisma cannot express these) ──
-- A balance can only ever be decremented under a conditional guard; six paths
-- write these columns and every one of them had to remember. Now the database
-- remembers.
ALTER TABLE "EmployerAccount" ADD CONSTRAINT employer_credits_nonneg
  CHECK (credits >= 0 AND "interviewCredits" >= 0);

-- Reconciliation groups by kind. An unknown value did not read as drift — it
-- fell out of the grouping and out of the report entirely.
ALTER TABLE "Entitlement" ADD CONSTRAINT entitlement_kind_check
  CHECK (kind IN ('credit', 'interview_credit'));

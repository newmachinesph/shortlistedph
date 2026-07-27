-- Two gaps that made whole journeys impossible rather than merely broken.
--
-- Interview.meetingUrl: the table carried a scheduled time and a recording key
-- but no way for the three parties to actually meet, and none of them holds
-- another's contact details. A booked interview could not take place.
--
-- Interviewer payout fields: the payout flow existed end to end except for the
-- destination — an admin chose "gcash" or "bank" for an account number the
-- database had never asked for or held.
--
-- NOTE: the generated diff again wanted to DROP talent_embedding_hnsw and
-- jd_embedding_hnsw — Prisma cannot see indexes on Unsupported("vector")
-- columns and reads them as drift. Deleted by hand. Check every migration.
-- The same blindness applies to interview_one_live_per_entry (a PARTIAL unique
-- index, the only guard against double-booking) and to every CHECK constraint.

ALTER TABLE "Interview" ADD COLUMN "meetingUrl" TEXT;

ALTER TABLE "Interviewer" ADD COLUMN     "payoutAccountName" TEXT,
ADD COLUMN     "payoutAccountNumber" TEXT,
ADD COLUMN     "payoutMethod" TEXT;

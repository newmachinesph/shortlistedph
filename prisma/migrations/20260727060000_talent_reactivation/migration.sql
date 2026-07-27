-- Re-activation for profiles imported from remotetalentph.
--
-- They are imported UNPUBLISHED by design (see scripts/migrate-profiles.ts):
-- these people signed up to a different product, and putting them in front of
-- employers without asking is the consent violation this platform exists to
-- prevent. They also have no Account row, so password reset cannot reach them —
-- this token is their only way in, exactly like a MatchConsent token.
--
-- reactivatedAt records that a real person came back, set a password and chose
-- what happens to their profile. Publishing is THEIR decision, never an
-- import's.
--
-- NOTE: the generated diff again wanted to DROP talent_embedding_hnsw and
-- jd_embedding_hnsw — Prisma cannot see indexes on Unsupported("vector")
-- columns and reads them as drift. Deleted by hand. The same blindness covers
-- interview_one_live_per_entry and all 17 CHECK constraints: it will not drop
-- them, but it will never recreate them either.

ALTER TABLE "TalentProfile" ADD COLUMN     "reactivatedAt" TIMESTAMP(3),
ADD COLUMN     "reactivationSentAt" TIMESTAMP(3),
ADD COLUMN     "reactivationToken" TEXT;

CREATE UNIQUE INDEX "TalentProfile_reactivationToken_key" ON "TalentProfile"("reactivationToken");

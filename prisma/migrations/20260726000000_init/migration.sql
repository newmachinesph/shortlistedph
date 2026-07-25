-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'talent',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "idToken" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TalentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "legacyId" TEXT,
    "headline" TEXT,
    "summary" TEXT,
    "city" TEXT,
    "yearsExperience" INTEGER NOT NULL DEFAULT 0,
    "rateUsd" DOUBLE PRECISION,
    "rateLockedUntil" TIMESTAMP(3),
    "availability" TEXT NOT NULL DEFAULT 'open',
    "committedHours" INTEGER NOT NULL DEFAULT 0,
    "visibility" BOOLEAN NOT NULL DEFAULT true,
    "verifiedTier" TEXT NOT NULL DEFAULT 'none',
    "resumeKey" TEXT,
    "portfolioUrl" TEXT,
    "linkedinUrl" TEXT,
    "githubUrl" TEXT,
    "education" TEXT,
    "englishLevel" TEXT,
    "tools" TEXT,
    "preferredOverlap" TEXT,
    "certifications" TEXT,
    "availabilityConfirmedAt" TIMESTAMP(3),
    "noticePeriodDays" INTEGER,
    "openToOffers" BOOLEAN NOT NULL DEFAULT true,
    "shortlistCount" INTEGER NOT NULL DEFAULT 0,
    "lastShownAt" TIMESTAMP(3),
    "dormantAt" TIMESTAMP(3),
    "flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "publishedAt" TIMESTAMP(3),
    "lastEditedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "embedding" vector(1536),
    "embeddingSkills" vector(1536),
    "embeddingExperience" vector(1536),
    "embeddingPrefs" vector(1536),

    CONSTRAINT "TalentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileTool" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "canonicalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "years" INTEGER,
    "lastUsedYear" INTEGER,
    "category" TEXT,

    CONSTRAINT "ProfileTool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Engagement" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "span" TEXT NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT 'reported',

    CONSTRAINT "Engagement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateChange" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "oldRate" DOUBLE PRECISION,
    "newRate" DOUBLE PRECISION NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployerAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "blurb" TEXT,
    "location" TEXT,
    "contactName" TEXT,
    "logoKey" TEXT,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "interviewCredits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobDescription" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "budgetMin" DOUBLE PRECISION,
    "budgetMax" DOUBLE PRECISION,
    "hoursPerWeek" INTEGER,
    "overlap" TEXT,
    "mustHaves" TEXT[],
    "niceToHaves" TEXT[],
    "requiredTools" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredTools" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "screeningQuestions" JSONB,
    "initialInstructions" TEXT,
    "schedulingUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hardRequirements" JSONB,
    "publicTitle" TEXT,
    "roleFamily" TEXT,
    "industry" TEXT,
    "clientRegion" TEXT,
    "listedAt" TIMESTAMP(3),
    "embedding" vector(1536),
    "embeddingSkills" vector(1536),

    CONSTRAINT "JobDescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchElimination" (
    "id" TEXT NOT NULL,
    "jdId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchElimination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchConsent" (
    "id" TEXT NOT NULL,
    "jdId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "token" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileSnapshot" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "jdId" TEXT NOT NULL,
    "frozenJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Slate" (
    "id" TEXT NOT NULL,
    "jdId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'preview',
    "unlockedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Slate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlateEntry" (
    "id" TEXT NOT NULL,
    "slateId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "dims" JSONB NOT NULL,
    "reasons" TEXT[],

    CONSTRAINT "SlateEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Connection" (
    "id" TEXT NOT NULL,
    "slateEntryId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'requested',
    "screeningAnswers" JSONB,
    "contactRevealedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agreement" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "terms" JSONB NOT NULL,
    "talentSignedAt" TIMESTAMP(3),
    "employerSignedAt" TIMESTAMP(3),
    "pdfKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Agreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutcomeConfirmation" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "talentConfirmedAt" TIMESTAMP(3),
    "employerConfirmedAt" TIMESTAMP(3),

    CONSTRAINT "OutcomeConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "categories" JSONB,
    "comment" TEXT,
    "revealedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entitlement" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'credit',
    "source" TEXT NOT NULL,
    "spentOnSlateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Entitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerRef" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityBinding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "diditSessionRef" TEXT,
    "faceEmbeddingRef" TEXT,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "IdentityBinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "filedById" TEXT NOT NULL,
    "againstId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "evidenceKeys" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "payoutMethod" TEXT,
    "payoutAccountName" TEXT,
    "payoutAccountNumber" TEXT,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralCommission" (
    "id" TEXT NOT NULL,
    "referralId" TEXT NOT NULL,
    "conversionId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payoutId" TEXT,

    CONSTRAINT "ReferralCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralClick" (
    "id" TEXT NOT NULL,
    "referralId" TEXT NOT NULL,
    "source" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralClick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralConversion" (
    "id" TEXT NOT NULL,
    "referralId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'signed_up',
    "rewardAmount" DECIMAL(10,2),
    "currency" TEXT,
    "paymentId" TEXT,
    "qualifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payoutId" TEXT,

    CONSTRAINT "ReferralConversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralPayout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PHP',
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "ReferralPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobDraft" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "title" TEXT,
    "rawText" TEXT,
    "budgetMin" DOUBLE PRECISION,
    "budgetMax" DOUBLE PRECISION,
    "hoursPerWeek" INTEGER,
    "overlap" TEXT,
    "mustHaves" TEXT[],
    "matchCount" INTEGER,
    "claimedByJdId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interviewer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" TEXT,
    "expertise" TEXT[],
    "languages" TEXT[],
    "yearsExperience" INTEGER NOT NULL DEFAULT 0,
    "rateUsd" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "avatarKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Interviewer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interview" (
    "id" TEXT NOT NULL,
    "slateEntryId" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "interviewerId" TEXT NOT NULL,
    "talentUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "priceUsd" DECIMAL(10,2) NOT NULL,
    "interviewerPayoutUsd" DECIMAL(10,2) NOT NULL,
    "suggestedQuestions" TEXT[],
    "employerNotes" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "recordingKey" TEXT,
    "paymentRef" TEXT,
    "payoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Interview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewAssessment" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "overall" INTEGER NOT NULL,
    "technical" INTEGER NOT NULL,
    "communication" INTEGER NOT NULL,
    "englishFluency" INTEGER NOT NULL,
    "strengths" TEXT NOT NULL,
    "concerns" TEXT NOT NULL,
    "notes" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewerPayout" (
    "id" TEXT NOT NULL,
    "interviewerId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "InterviewerPayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_status_idx" ON "user"("status");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TalentProfile_userId_key" ON "TalentProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TalentProfile_legacyId_key" ON "TalentProfile"("legacyId");

-- CreateIndex
CREATE INDEX "TalentProfile_publishedAt_visibility_idx" ON "TalentProfile"("publishedAt", "visibility");

-- CreateIndex
CREATE INDEX "Skill_profileId_idx" ON "Skill"("profileId");

-- CreateIndex
CREATE INDEX "Skill_normalizedName_idx" ON "Skill"("normalizedName");

-- CreateIndex
CREATE INDEX "ProfileTool_canonicalId_idx" ON "ProfileTool"("canonicalId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileTool_profileId_canonicalId_key" ON "ProfileTool"("profileId", "canonicalId");

-- CreateIndex
CREATE INDEX "Engagement_profileId_idx" ON "Engagement"("profileId");

-- CreateIndex
CREATE INDEX "RateChange_profileId_changedAt_idx" ON "RateChange"("profileId", "changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmployerAccount_userId_key" ON "EmployerAccount"("userId");

-- CreateIndex
CREATE INDEX "JobDescription_employerId_status_idx" ON "JobDescription"("employerId", "status");

-- CreateIndex
CREATE INDEX "JobDescription_status_idx" ON "JobDescription"("status");

-- CreateIndex
CREATE INDEX "JobDescription_listedAt_idx" ON "JobDescription"("listedAt");

-- CreateIndex
CREATE INDEX "MatchElimination_jdId_reason_idx" ON "MatchElimination"("jdId", "reason");

-- CreateIndex
CREATE UNIQUE INDEX "MatchConsent_token_key" ON "MatchConsent"("token");

-- CreateIndex
CREATE INDEX "MatchConsent_status_expiresAt_idx" ON "MatchConsent"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "MatchConsent_jdId_profileId_key" ON "MatchConsent"("jdId", "profileId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileSnapshot_profileId_jdId_key" ON "ProfileSnapshot"("profileId", "jdId");

-- CreateIndex
CREATE INDEX "Slate_jdId_idx" ON "Slate"("jdId");

-- CreateIndex
CREATE INDEX "Slate_status_idx" ON "Slate"("status");

-- CreateIndex
CREATE INDEX "SlateEntry_slateId_rank_idx" ON "SlateEntry"("slateId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "Connection_slateEntryId_key" ON "Connection"("slateEntryId");

-- CreateIndex
CREATE INDEX "Connection_state_idx" ON "Connection"("state");

-- CreateIndex
CREATE UNIQUE INDEX "Agreement_connectionId_key" ON "Agreement"("connectionId");

-- CreateIndex
CREATE UNIQUE INDEX "OutcomeConfirmation_agreementId_period_key" ON "OutcomeConfirmation"("agreementId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_agreementId_direction_key" ON "Rating"("agreementId", "direction");

-- CreateIndex
CREATE INDEX "Message_connectionId_createdAt_idx" ON "Message"("connectionId", "createdAt");

-- CreateIndex
CREATE INDEX "Entitlement_employerId_idx" ON "Entitlement"("employerId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerRef_key" ON "Payment"("providerRef");

-- CreateIndex
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityBinding_userId_key" ON "IdentityBinding"("userId");

-- CreateIndex
CREATE INDEX "Report_status_idx" ON "Report"("status");

-- CreateIndex
CREATE INDEX "Report_filedById_idx" ON "Report"("filedById");

-- CreateIndex
CREATE INDEX "Report_againstId_idx" ON "Report"("againstId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_userId_key" ON "Referral"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_code_key" ON "Referral"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCommission_paymentId_key" ON "ReferralCommission"("paymentId");

-- CreateIndex
CREATE INDEX "ReferralCommission_referralId_payoutId_idx" ON "ReferralCommission"("referralId", "payoutId");

-- CreateIndex
CREATE INDEX "ReferralCommission_conversionId_idx" ON "ReferralCommission"("conversionId");

-- CreateIndex
CREATE INDEX "ReferralClick_referralId_createdAt_idx" ON "ReferralClick"("referralId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralConversion_userId_key" ON "ReferralConversion"("userId");

-- CreateIndex
CREATE INDEX "ReferralConversion_referralId_status_idx" ON "ReferralConversion"("referralId", "status");

-- CreateIndex
CREATE INDEX "ReferralConversion_payoutId_idx" ON "ReferralConversion"("payoutId");

-- CreateIndex
CREATE INDEX "ReferralPayout_userId_status_idx" ON "ReferralPayout"("userId", "status");

-- CreateIndex
CREATE INDEX "ReferralPayout_status_idx" ON "ReferralPayout"("status");

-- CreateIndex
CREATE UNIQUE INDEX "JobDraft_token_key" ON "JobDraft"("token");

-- CreateIndex
CREATE INDEX "JobDraft_createdAt_idx" ON "JobDraft"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Interviewer_userId_key" ON "Interviewer"("userId");

-- CreateIndex
CREATE INDEX "Interviewer_status_idx" ON "Interviewer"("status");

-- CreateIndex
CREATE INDEX "Interview_employerId_status_idx" ON "Interview"("employerId", "status");

-- CreateIndex
CREATE INDEX "Interview_interviewerId_status_idx" ON "Interview"("interviewerId", "status");

-- CreateIndex
CREATE INDEX "Interview_talentUserId_status_idx" ON "Interview"("talentUserId", "status");

-- CreateIndex
CREATE INDEX "Interview_payoutId_idx" ON "Interview"("payoutId");

-- CreateIndex
CREATE INDEX "Interview_status_idx" ON "Interview"("status");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewAssessment_interviewId_key" ON "InterviewAssessment"("interviewId");

-- CreateIndex
CREATE INDEX "InterviewerPayout_interviewerId_status_idx" ON "InterviewerPayout"("interviewerId", "status");

-- CreateIndex
CREATE INDEX "InterviewerPayout_status_idx" ON "InterviewerPayout"("status");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentProfile" ADD CONSTRAINT "TalentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TalentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileTool" ADD CONSTRAINT "ProfileTool_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TalentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Engagement" ADD CONSTRAINT "Engagement_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TalentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateChange" ADD CONSTRAINT "RateChange_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TalentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployerAccount" ADD CONSTRAINT "EmployerAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobDescription" ADD CONSTRAINT "JobDescription_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "EmployerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchElimination" ADD CONSTRAINT "MatchElimination_jdId_fkey" FOREIGN KEY ("jdId") REFERENCES "JobDescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchConsent" ADD CONSTRAINT "MatchConsent_jdId_fkey" FOREIGN KEY ("jdId") REFERENCES "JobDescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchConsent" ADD CONSTRAINT "MatchConsent_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TalentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileSnapshot" ADD CONSTRAINT "ProfileSnapshot_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TalentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileSnapshot" ADD CONSTRAINT "ProfileSnapshot_jdId_fkey" FOREIGN KEY ("jdId") REFERENCES "JobDescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Slate" ADD CONSTRAINT "Slate_jdId_fkey" FOREIGN KEY ("jdId") REFERENCES "JobDescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateEntry" ADD CONSTRAINT "SlateEntry_slateId_fkey" FOREIGN KEY ("slateId") REFERENCES "Slate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateEntry" ADD CONSTRAINT "SlateEntry_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "ProfileSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_slateEntryId_fkey" FOREIGN KEY ("slateEntryId") REFERENCES "SlateEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutcomeConfirmation" ADD CONSTRAINT "OutcomeConfirmation_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "EmployerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityBinding" ADD CONSTRAINT "IdentityBinding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_filedById_fkey" FOREIGN KEY ("filedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_againstId_fkey" FOREIGN KEY ("againstId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_conversionId_fkey" FOREIGN KEY ("conversionId") REFERENCES "ReferralConversion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "ReferralPayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralClick" ADD CONSTRAINT "ReferralClick_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralConversion" ADD CONSTRAINT "ReferralConversion_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralConversion" ADD CONSTRAINT "ReferralConversion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralConversion" ADD CONSTRAINT "ReferralConversion_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "ReferralPayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralPayout" ADD CONSTRAINT "ReferralPayout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interviewer" ADD CONSTRAINT "Interviewer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_slateEntryId_fkey" FOREIGN KEY ("slateEntryId") REFERENCES "SlateEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "EmployerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_interviewerId_fkey" FOREIGN KEY ("interviewerId") REFERENCES "Interviewer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_talentUserId_fkey" FOREIGN KEY ("talentUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "InterviewerPayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewAssessment" ADD CONSTRAINT "InterviewAssessment_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewerPayout" ADD CONSTRAINT "InterviewerPayout_interviewerId_fkey" FOREIGN KEY ("interviewerId") REFERENCES "Interviewer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Beyond the schema DSL (folded in from scripts/db-hardening.sql) ──────

-- ANN vector indexes: without these every match computes cosine distance
-- against the whole published pool. hnsw needs no training step.
CREATE INDEX "talent_embedding_hnsw"
  ON "TalentProfile" USING hnsw (embedding vector_cosine_ops);
CREATE INDEX "jd_embedding_hnsw"
  ON "JobDescription" USING hnsw (embedding vector_cosine_ops);

-- One live interview per candidate entry (partial unique — declined/cancelled
-- may be retried). The create path catches P2002 and returns 409.
CREATE UNIQUE INDEX "interview_one_live_per_entry"
  ON "Interview" ("slateEntryId")
  WHERE status NOT IN ('declined', 'cancelled');

-- CHECK constraints on status-like String columns (value sets confirmed
-- against every write site in src/).
ALTER TABLE "user" ADD CONSTRAINT user_status_check
  CHECK (status IN ('active', 'suspended', 'banned'));
ALTER TABLE "user" ADD CONSTRAINT user_role_check
  CHECK (role IN ('talent', 'employer', 'admin', 'interviewer'));
ALTER TABLE "TalentProfile" ADD CONSTRAINT talent_availability_check
  CHECK (availability IN ('open', 'partial', 'booked'));
ALTER TABLE "TalentProfile" ADD CONSTRAINT talent_verified_tier_check
  CHECK ("verifiedTier" IN ('none', 'id_verified'));
ALTER TABLE "JobDescription" ADD CONSTRAINT jd_status_check
  CHECK (status IN ('draft', 'matching', 'rematching', 'slate_ready', 'no_matches', 'failed', 'closed'));
ALTER TABLE "Slate" ADD CONSTRAINT slate_status_check
  CHECK (status IN ('pending_review', 'preview', 'unlocked'));
ALTER TABLE "MatchConsent" ADD CONSTRAINT match_consent_status_check
  CHECK (status IN ('pending', 'accepted', 'declined', 'expired'));
ALTER TABLE "Connection" ADD CONSTRAINT connection_state_check
  CHECK (state IN ('requested', 'consented', 'declined', 'expired'));
ALTER TABLE "Payment" ADD CONSTRAINT payment_status_check
  CHECK (status IN ('pending', 'paid', 'failed', 'refunded'));
ALTER TABLE "Interview" ADD CONSTRAINT interview_status_check
  CHECK (status IN ('requested', 'consented', 'paid', 'scheduled', 'recorded', 'reported', 'declined', 'cancelled'));
ALTER TABLE "Interviewer" ADD CONSTRAINT interviewer_status_check
  CHECK (status IN ('pending', 'active', 'paused'));
ALTER TABLE "ReferralConversion" ADD CONSTRAINT referral_conversion_status_check
  CHECK (status IN ('signed_up', 'qualified', 'void'));
ALTER TABLE "ReferralPayout" ADD CONSTRAINT referral_payout_status_check
  CHECK (status IN ('pending', 'paid', 'rejected'));
ALTER TABLE "InterviewerPayout" ADD CONSTRAINT interviewer_payout_status_check
  CHECK (status IN ('pending', 'paid', 'rejected'));

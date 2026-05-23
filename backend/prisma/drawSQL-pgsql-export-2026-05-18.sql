CREATE TABLE "User"(
    "id" VARCHAR(255) NOT NULL,
    "username" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NULL,
    "role" VARCHAR(255) NOT NULL DEFAULT 'DOCTOR',
    "status" VARCHAR(255) NOT NULL DEFAULT 'PENDING',
    "firstLogin" BOOLEAN NOT NULL DEFAULT TRUE,
    "registrationStep" INT NOT NULL DEFAULT 1,
    "inviteToken" VARCHAR(255) NULL,
    "inviteTokenExpiry" TIMESTAMP(3) NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);
ALTER TABLE "User" ADD PRIMARY KEY("id");
ALTER TABLE "User" ADD CONSTRAINT "user_username_unique" UNIQUE("username");
ALTER TABLE "User" ADD CONSTRAINT "user_email_unique" UNIQUE("email");
ALTER TABLE "User" ADD CONSTRAINT "user_invitetoken_unique" UNIQUE("inviteToken");

CREATE TABLE "AdminProfile"(
    "id" VARCHAR(255) NOT NULL,
    "userId" VARCHAR(255) NOT NULL,
    "adminUserName" VARCHAR(255) NOT NULL,
    "walletAddress" VARCHAR(255) NULL,
    "zkpPublicKey" VARCHAR(255) NULL,
    "zkpSecret" VARCHAR(255) NULL,
    "zkpCommitment" VARCHAR(255) NULL,
    "nonce" VARCHAR(255) NULL,
    "mfaSecret" VARCHAR(255) NULL,
    "mfaExpiry" TIMESTAMP(3) NULL,
    "faceEmbedding" TEXT NULL,
    "faceHash" VARCHAR(255) NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);
ALTER TABLE "AdminProfile" ADD PRIMARY KEY("id");
ALTER TABLE "AdminProfile" ADD CONSTRAINT "adminprofile_userid_unique" UNIQUE("userId");
ALTER TABLE "AdminProfile" ADD CONSTRAINT "adminprofile_adminusername_unique" UNIQUE("adminUserName");
ALTER TABLE "AdminProfile" ADD CONSTRAINT "adminprofile_walletaddress_unique" UNIQUE("walletAddress");

CREATE TABLE "DoctorProfile"(
    "id" VARCHAR(255) NOT NULL,
    "userId" VARCHAR(255) NOT NULL,
    "doctorName" VARCHAR(255) NOT NULL,
    "licenseId" VARCHAR(255) NOT NULL,
    "portraitImage" TEXT NULL,
    "blockchainHash" VARCHAR(255) NULL,
    "faceEmbedding" TEXT NULL,
    "faceEmbeddingHash" VARCHAR(255) NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "identityNumber" VARCHAR(255) NOT NULL,
    "specialties" VARCHAR(255) NOT NULL,
    "degree" VARCHAR(255) NOT NULL,
    "facultyOfWork" VARCHAR(255) NOT NULL,
    "position" VARCHAR(255) NOT NULL,
    "workingStartDate" TIMESTAMP(3) NOT NULL,
    "doctorStatus" VARCHAR(255) NOT NULL DEFAULT 'ACTIVE',
    "blockchainHistoryId" VARCHAR(255) NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);
ALTER TABLE "DoctorProfile" ADD PRIMARY KEY("id");
ALTER TABLE "DoctorProfile" ADD CONSTRAINT "doctorprofile_userid_unique" UNIQUE("userId");
ALTER TABLE "DoctorProfile" ADD CONSTRAINT "doctorprofile_licenseid_unique" UNIQUE("licenseId");
ALTER TABLE "DoctorProfile" ADD CONSTRAINT "doctorprofile_identitynumber_unique" UNIQUE("identityNumber");
ALTER TABLE "DoctorProfile" ADD CONSTRAINT "doctorprofile_blockchainhistoryid_unique" UNIQUE("blockchainHistoryId");

CREATE TABLE "BlockchainHistory"(
    "id" VARCHAR(255) NOT NULL,
    "transactionId" VARCHAR(255) NOT NULL,
    "confirmTime" TIMESTAMP(3) NOT NULL,
    "blockchainStatus" VARCHAR(255) NOT NULL,
    "errorReason" TEXT NULL,
    "errorLog" TEXT NULL,
    "retryCount" INT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);
ALTER TABLE "BlockchainHistory" ADD PRIMARY KEY("id");
ALTER TABLE "BlockchainHistory" ADD CONSTRAINT "blockchainhistory_transactionid_unique" UNIQUE("transactionId");

CREATE TABLE "AiModelInfo"(
    "id" VARCHAR(255) NOT NULL,
    "modelName" VARCHAR(255) NOT NULL,
    "version" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);
ALTER TABLE "AiModelInfo" ADD PRIMARY KEY("id");

CREATE TABLE "AiModelRegistry"(
    "id" VARCHAR(255) NOT NULL,
    "modelId" VARCHAR(255) NOT NULL,
    "modelName" VARCHAR(255) NOT NULL,
    "modelVersion" VARCHAR(255) NOT NULL,
    "recommendedSpecialty" VARCHAR(255) NULL,
    "ipHashEncrypted" TEXT NOT NULL,
    "ipHashPlain" TEXT NULL,
    "blockchainTxHash" VARCHAR(255) NULL,
    "isActiveOnChain" BOOLEAN NOT NULL DEFAULT FALSE,
    "description" TEXT NULL,
    "createdBy" VARCHAR(255) NOT NULL,
    "type" VARCHAR(255) NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);
ALTER TABLE "AiModelRegistry" ADD PRIMARY KEY("id");
ALTER TABLE "AiModelRegistry" ADD CONSTRAINT "aimodelregistry_modelid_unique" UNIQUE("modelId");
CREATE INDEX "aimodelregistry_modelid_idx" ON "AiModelRegistry"("modelId");
CREATE INDEX "aimodelregistry_isactiveonchain_idx" ON "AiModelRegistry"("isActiveOnChain");

CREATE TABLE "AiDiagnosis"(
    "id" VARCHAR(255) NOT NULL,
    "doctorId" VARCHAR(255) NOT NULL,
    "aiModelId" VARCHAR(255) NOT NULL,
    "inputImageHash" VARCHAR(255) NOT NULL,
    "aiDiagnoseConfidentResults" TEXT NOT NULL,
    "aiDiagnoseSegmentImageHash" VARCHAR(255) NOT NULL,
    "diagnoseStatus" VARCHAR(255) NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);
ALTER TABLE "AiDiagnosis" ADD PRIMARY KEY("id");

CREATE TABLE "DoctorFinalConclude"(
    "id" VARCHAR(255) NOT NULL,
    "diagnoseId" VARCHAR(255) NOT NULL,
    "finalConclusionMessageHash" VARCHAR(255) NOT NULL,
    "treatmentRegimen" TEXT NOT NULL,
    "note" TEXT NULL,
    "blockchainHistoryId" VARCHAR(255) NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);
ALTER TABLE "DoctorFinalConclude" ADD PRIMARY KEY("id");
ALTER TABLE "DoctorFinalConclude" ADD CONSTRAINT "doctorfinalconclude_diagnoseid_unique" UNIQUE("diagnoseId");
ALTER TABLE "DoctorFinalConclude" ADD CONSTRAINT "doctorfinalconclude_blockchainhistoryid_unique" UNIQUE("blockchainHistoryId");

CREATE TABLE "AiQuality"(
    "id" VARCHAR(255) NOT NULL,
    "doctorId" VARCHAR(255) NOT NULL,
    "aiModelId" VARCHAR(255) NOT NULL,
    "doctorConclusionAboutModel" TEXT NOT NULL,
    "trustablePercent" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);
ALTER TABLE "AiQuality" ADD PRIMARY KEY("id");

CREATE TABLE "PasswordResetStatus"(
    "id" VARCHAR(255) NOT NULL,
    "userId" VARCHAR(255) NOT NULL,
    "securityCode" VARCHAR(255) NOT NULL,
    "status" VARCHAR(255) NOT NULL,
    "expiredTime" TIMESTAMP(3) NOT NULL
);
ALTER TABLE "PasswordResetStatus" ADD PRIMARY KEY("id");

ALTER TABLE "AdminProfile" ADD CONSTRAINT "adminprofile_userid_foreign" FOREIGN KEY("userId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "DoctorProfile" ADD CONSTRAINT "doctorprofile_userid_foreign" FOREIGN KEY("userId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "DoctorProfile" ADD CONSTRAINT "doctorprofile_blockchainhistoryid_foreign" FOREIGN KEY("blockchainHistoryId") REFERENCES "BlockchainHistory"("id") ON DELETE SET NULL;
ALTER TABLE "AiDiagnosis" ADD CONSTRAINT "aidiagnosis_doctorid_foreign" FOREIGN KEY("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE NO ACTION;
ALTER TABLE "AiDiagnosis" ADD CONSTRAINT "aidiagnosis_aimodelid_foreign" FOREIGN KEY("aiModelId") REFERENCES "AiModelInfo"("id") ON DELETE CASCADE;
ALTER TABLE "DoctorFinalConclude" ADD CONSTRAINT "doctorfinalconclude_diagnoseid_foreign" FOREIGN KEY("diagnoseId") REFERENCES "AiDiagnosis"("id") ON DELETE CASCADE;
ALTER TABLE "DoctorFinalConclude" ADD CONSTRAINT "doctorfinalconclude_blockchainhistoryid_foreign" FOREIGN KEY("blockchainHistoryId") REFERENCES "BlockchainHistory"("id") ON DELETE SET NULL;
ALTER TABLE "AiQuality" ADD CONSTRAINT "aiquality_doctorid_foreign" FOREIGN KEY("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE NO ACTION;
ALTER TABLE "AiQuality" ADD CONSTRAINT "aiquality_aimodelid_foreign" FOREIGN KEY("aiModelId") REFERENCES "AiModelInfo"("id") ON DELETE CASCADE;
ALTER TABLE "PasswordResetStatus" ADD CONSTRAINT "passwordresetstatus_userid_foreign" FOREIGN KEY("userId") REFERENCES "User"("id") ON DELETE CASCADE;
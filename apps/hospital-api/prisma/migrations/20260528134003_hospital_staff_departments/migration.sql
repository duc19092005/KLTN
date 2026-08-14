-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'RECEPTIONIST', 'DOCTOR', 'LAB_MANAGER', 'TECHNICIAN', 'PATIENT');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING');

-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "firstLogin" BOOLEAN NOT NULL DEFAULT true,
    "registrationStep" INTEGER NOT NULL DEFAULT 1,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "inviteToken" TEXT,
    "inviteTokenExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "managerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StaffProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "gender" TEXT,
    "employeeCode" TEXT NOT NULL,
    "position" TEXT,
    "walletAddress" TEXT,
    "faceEmbedding" TEXT,
    "faceHash" TEXT,
    "nonce" TEXT,
    "nonceExpiresAt" TIMESTAMP(3),
    "noncePurpose" TEXT,
    "mfaSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AdminProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "adminUserName" TEXT NOT NULL,
    "walletAddress" TEXT,
    "faceEmbedding" TEXT,
    "faceHash" TEXT,
    "nonce" TEXT,
    "nonceExpiresAt" TIMESTAMP(3),
    "noncePurpose" TEXT,
    "mfaSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DoctorProfile" (
    "id" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "specialty" TEXT,
    "licenseNumber" TEXT,
    "qualification" TEXT,
    "yearsExperience" INTEGER DEFAULT 0,
    "hash256" TEXT,
    "dataSalt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Patient" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "patientCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "gender" TEXT,
    "birthDate" TIMESTAMP(3),
    "citizenId" TEXT,
    "phoneNumber" TEXT,
    "insuranceNumber" TEXT,
    "address" TEXT,
    "emergencyContact" JSONB,
    "hash256" TEXT,
    "dataSalt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PatientAccess" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "grantedToId" TEXT,
    "verifiedById" TEXT,
    "relationship" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Visit" (
    "id" TEXT NOT NULL,
    "visitCode" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "departmentId" TEXT,
    "doctorId" TEXT,
    "visitType" TEXT DEFAULT 'EXAMINATION',
    "status" TEXT DEFAULT 'IN_PROGRESS',
    "chiefComplaint" TEXT,
    "admissionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dischargeDate" TIMESTAMP(3),
    "hash256" TEXT,
    "dataSalt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BlockchainLogger" (
    "id" TEXT NOT NULL,
    "eventId" TEXT,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "dataHash" TEXT,
    "dataSalt" TEXT,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "beforeHash" TEXT,
    "afterHash" TEXT,
    "diffHash" TEXT,
    "hashVersion" TEXT,
    "beforeEncrypted" JSONB,
    "afterEncrypted" JSONB,
    "encryptionVersion" TEXT,
    "encryptionKeyId" TEXT,
    "diffJson" JSONB,
    "fieldsChanged" JSONB,
    "txHash" TEXT,
    "blockNumber" INTEGER,
    "onChainStatus" TEXT DEFAULT 'PENDING',
    "seq" INTEGER,
    "prevHash" TEXT,
    "entryHash" TEXT,
    "batchId" INTEGER,
    "departmentId" TEXT,
    "staffProfileId" TEXT,
    "doctorProfileId" TEXT,
    "patientId" TEXT,
    "aiModelRegistryId" TEXT,
    "medicalConclusionId" TEXT,
    "aiQualityId" TEXT,
    "staffShiftId" TEXT,
    "handoverLogId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlockchainLogger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OtpVerification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtpVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'SYSTEM',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "User_inviteToken_key" ON "User"("inviteToken");
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");
CREATE INDEX IF NOT EXISTS "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Department_name_key" ON "Department"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "Department_managerId_key" ON "Department"("managerId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "StaffProfile_userId_key" ON "StaffProfile"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "StaffProfile_employeeCode_key" ON "StaffProfile"("employeeCode");
CREATE UNIQUE INDEX IF NOT EXISTS "StaffProfile_walletAddress_key" ON "StaffProfile"("walletAddress");
CREATE INDEX IF NOT EXISTS "StaffProfile_departmentId_idx" ON "StaffProfile"("departmentId");
CREATE INDEX IF NOT EXISTS "StaffProfile_walletAddress_idx" ON "StaffProfile"("walletAddress");
CREATE INDEX IF NOT EXISTS "StaffProfile_noncePurpose_nonceExpiresAt_idx" ON "StaffProfile"("noncePurpose", "nonceExpiresAt");
CREATE INDEX IF NOT EXISTS "StaffProfile_fullName_idx" ON "StaffProfile"("fullName");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AdminProfile_userId_key" ON "AdminProfile"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "AdminProfile_adminUserName_key" ON "AdminProfile"("adminUserName");
CREATE UNIQUE INDEX IF NOT EXISTS "AdminProfile_walletAddress_key" ON "AdminProfile"("walletAddress");
CREATE INDEX IF NOT EXISTS "AdminProfile_walletAddress_idx" ON "AdminProfile"("walletAddress");
CREATE INDEX IF NOT EXISTS "AdminProfile_noncePurpose_nonceExpiresAt_idx" ON "AdminProfile"("noncePurpose", "nonceExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DoctorProfile_staffProfileId_key" ON "DoctorProfile"("staffProfileId");
CREATE UNIQUE INDEX IF NOT EXISTS "DoctorProfile_licenseNumber_key" ON "DoctorProfile"("licenseNumber");
CREATE INDEX IF NOT EXISTS "DoctorProfile_specialty_idx" ON "DoctorProfile"("specialty");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Patient_userId_key" ON "Patient"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "Patient_patientCode_key" ON "Patient"("patientCode");
CREATE UNIQUE INDEX IF NOT EXISTS "Patient_citizenId_key" ON "Patient"("citizenId");
CREATE UNIQUE INDEX IF NOT EXISTS "Patient_phoneNumber_key" ON "Patient"("phoneNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "Patient_insuranceNumber_key" ON "Patient"("insuranceNumber");
CREATE INDEX IF NOT EXISTS "Patient_fullName_idx" ON "Patient"("fullName");
CREATE INDEX IF NOT EXISTS "Patient_phoneNumber_idx" ON "Patient"("phoneNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PatientAccess_patientId_idx" ON "PatientAccess"("patientId");
CREATE INDEX IF NOT EXISTS "PatientAccess_grantedToId_idx" ON "PatientAccess"("grantedToId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Visit_visitCode_key" ON "Visit"("visitCode");
CREATE INDEX IF NOT EXISTS "Visit_patientId_idx" ON "Visit"("patientId");
CREATE INDEX IF NOT EXISTS "Visit_departmentId_idx" ON "Visit"("departmentId");
CREATE INDEX IF NOT EXISTS "Visit_doctorId_idx" ON "Visit"("doctorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_actorId_idx" ON "AuditLog"("actorId");
CREATE INDEX IF NOT EXISTS "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");
CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BlockchainLogger_actorId_idx" ON "BlockchainLogger"("actorId");
CREATE INDEX IF NOT EXISTS "BlockchainLogger_entity_entityId_idx" ON "BlockchainLogger"("entity", "entityId");
CREATE INDEX IF NOT EXISTS "BlockchainLogger_action_idx" ON "BlockchainLogger"("action");
CREATE INDEX IF NOT EXISTS "BlockchainLogger_createdAt_idx" ON "BlockchainLogger"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RefreshToken_token_key" ON "RefreshToken"("token");
CREATE INDEX IF NOT EXISTS "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OtpVerification_identifier_purpose_idx" ON "OtpVerification"("identifier", "purpose");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX IF NOT EXISTS "Notification_read_idx" ON "Notification"("read");

-- AddForeignKey
ALTER TABLE "Department" DROP CONSTRAINT IF EXISTS "Department_managerId_fkey";
ALTER TABLE "Department" ADD CONSTRAINT "Department_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "StaffProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StaffProfile" DROP CONSTRAINT IF EXISTS "StaffProfile_userId_fkey";
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffProfile" DROP CONSTRAINT IF EXISTS "StaffProfile_departmentId_fkey";
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AdminProfile" DROP CONSTRAINT IF EXISTS "AdminProfile_userId_fkey";
ALTER TABLE "AdminProfile" ADD CONSTRAINT "AdminProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DoctorProfile" DROP CONSTRAINT IF EXISTS "DoctorProfile_staffProfileId_fkey";
ALTER TABLE "DoctorProfile" ADD CONSTRAINT "DoctorProfile_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Patient" DROP CONSTRAINT IF EXISTS "Patient_userId_fkey";
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PatientAccess" DROP CONSTRAINT IF EXISTS "PatientAccess_patientId_fkey";
ALTER TABLE "PatientAccess" ADD CONSTRAINT "PatientAccess_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PatientAccess" DROP CONSTRAINT IF EXISTS "PatientAccess_grantedToId_fkey";
ALTER TABLE "PatientAccess" ADD CONSTRAINT "PatientAccess_grantedToId_fkey" FOREIGN KEY ("grantedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PatientAccess" DROP CONSTRAINT IF EXISTS "PatientAccess_verifiedById_fkey";
ALTER TABLE "PatientAccess" ADD CONSTRAINT "PatientAccess_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Visit" DROP CONSTRAINT IF EXISTS "Visit_patientId_fkey";
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Visit" DROP CONSTRAINT IF EXISTS "Visit_departmentId_fkey";
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Visit" DROP CONSTRAINT IF EXISTS "Visit_doctorId_fkey";
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BlockchainLogger" DROP CONSTRAINT IF EXISTS "BlockchainLogger_actorId_fkey";
ALTER TABLE "BlockchainLogger" ADD CONSTRAINT "BlockchainLogger_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RefreshToken" DROP CONSTRAINT IF EXISTS "RefreshToken_userId_fkey";
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification" DROP CONSTRAINT IF EXISTS "Notification_userId_fkey";
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

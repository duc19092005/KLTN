-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'RECEPTIONIST', 'DOCTOR', 'LAB_MANAGER', 'PATIENT');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING', 'DELETE');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('PATIENT_LOGIN');

-- CreateEnum
CREATE TYPE "PatientRelationship" AS ENUM ('SELF', 'CHILD', 'PARENT', 'SPOUSE', 'GUARDIAN', 'OTHER');

-- CreateEnum
CREATE TYPE "PatientAccessStatus" AS ENUM ('ACTIVE', 'PENDING', 'REVOKED');

-- CreateEnum
CREATE TYPE "DepartmentType" AS ENUM ('ADMINISTRATIVE', 'EXAMINATION', 'CLINICAL', 'LABORATORY', 'IMAGING', 'PHARMACY', 'OTHER');

-- CreateEnum
CREATE TYPE "OperationalStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DELETE');

-- CreateEnum
CREATE TYPE "LabSpecialty" AS ENUM ('LABORATORY', 'IMAGING', 'BOTH');

-- CreateEnum
CREATE TYPE "MedicalSpecialty" AS ENUM ('GENERAL_INTERNAL_MEDICINE', 'GENERAL_SURGERY', 'PEDIATRICS', 'OBSTETRICS_GYNECOLOGY', 'CARDIOLOGY', 'ENT', 'DENTOMAXILLOFACIAL', 'OPHTHALMOLOGY', 'DERMATOLOGY', 'NEUROLOGY', 'ORTHOPEDICS', 'GASTROENTEROLOGY', 'ENDOCRINOLOGY', 'ONCOLOGY', 'RESPIRATORY');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CANCELLED', 'EXPIRED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "VisitSource" AS ENUM ('WALK_IN', 'APPOINTMENT');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('WAITING', 'IN_PROGRESS', 'WAITING_TEST_RESULT', 'WAITING_CONCLUSION', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MedicalOrderStatus" AS ENUM ('ORDERED', 'IN_PROGRESS', 'RESULT_READY', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "phoneNormalized" TEXT,
    "passwordHash" TEXT,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "firstLogin" BOOLEAN NOT NULL DEFAULT true,
    "registrationStep" INTEGER NOT NULL DEFAULT 1,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "inviteToken" TEXT,
    "inviteTokenExpiry" TIMESTAMP(3),
    "faceEmbedding" TEXT,
    "faceHash" TEXT,
    "faceModelVersion" TEXT,
    "faceEnrolledAt" TIMESTAMP(3),
    "faceSampleCount" INTEGER,
    "faceChallenge" TEXT,
    "faceChallengeExpiresAt" TIMESTAMP(3),
    "failedFaceAttempts" INTEGER NOT NULL DEFAULT 0,
    "faceLockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "restoredAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "departmentCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "floor" TEXT,
    "status" "OperationalStatus" NOT NULL DEFAULT 'ACTIVE',
    "type" "DepartmentType" NOT NULL DEFAULT 'CLINICAL',
    "canReceiveOrders" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "managerId" TEXT,
    "hash256" TEXT,
    "dataSalt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "restoredAt" TIMESTAMP(3),

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "citizenId" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "address" TEXT,
    "avatarUrl" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "position" TEXT,
    "labSpecialty" "LabSpecialty",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "hash256" TEXT,
    "dataSalt" TEXT,

    CONSTRAINT "StaffProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorProfile" (
    "id" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "specialty" "MedicalSpecialty" NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "qualification" TEXT NOT NULL,
    "yearsExperience" INTEGER,
    "hash256" TEXT,
    "dataSalt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "patientCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "citizenId" TEXT,
    "contactPhone" TEXT,
    "address" TEXT,
    "insuranceNumber" TEXT,
    "emergencyContact" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "hash256" TEXT,
    "dataSalt" TEXT,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "relationship" "PatientRelationship" NOT NULL DEFAULT 'SELF',
    "status" "PatientAccessStatus" NOT NULL DEFAULT 'ACTIVE',
    "canViewProfile" BOOLEAN NOT NULL DEFAULT true,
    "canViewVisits" BOOLEAN NOT NULL DEFAULT true,
    "canViewResults" BOOLEAN NOT NULL DEFAULT true,
    "canBookVisit" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "adminUserName" TEXT NOT NULL,
    "walletAddress" TEXT,
    "nonce" TEXT,
    "nonceExpiresAt" TIMESTAMP(3),
    "noncePurpose" TEXT,
    "mfaSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
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
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "visitCode" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "staffId" TEXT,
    "status" "VisitStatus" NOT NULL DEFAULT 'WAITING',
    "source" "VisitSource" NOT NULL DEFAULT 'WALK_IN',
    "checkInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "appointmentCode" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "doctorId" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'CONFIRMED',
    "qrTokenHash" TEXT NOT NULL,
    "qrExpiresAt" TIMESTAMP(3) NOT NULL,
    "checkedInAt" TIMESTAMP(3),
    "visitId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalOrder" (
    "id" TEXT NOT NULL,
    "orderCode" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "targetDepartmentId" TEXT,
    "orderType" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "clinicalNote" TEXT,
    "status" "MedicalOrderStatus" NOT NULL DEFAULT 'ORDERED',
    "orderedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalResult" (
    "id" TEXT NOT NULL,
    "resultCode" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "performedById" TEXT,
    "note" TEXT,
    "returnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalResultFile" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "url" TEXT,
    "storageProvider" TEXT NOT NULL DEFAULT 'CLOUDINARY',
    "bucket" TEXT,
    "objectKey" TEXT,
    "sha256" TEXT,
    "etag" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicalResultFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiModelRegistry" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "recommendedSpecialty" TEXT,
    "ipHashEncrypted" TEXT NOT NULL,
    "ipHashPlain" TEXT,
    "apiEndpoint" TEXT,
    "provider" TEXT,
    "isActiveOnChain" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdBy" TEXT NOT NULL,
    "type" TEXT,
    "status" "OperationalStatus" NOT NULL DEFAULT 'ACTIVE',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "restoredAt" TIMESTAMP(3),
    "hash256" TEXT,
    "dataSalt" TEXT,

    CONSTRAINT "AiModelRegistry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiDiagnosis" (
    "id" TEXT NOT NULL,
    "aiModelId" TEXT NOT NULL,
    "patientId" TEXT,
    "visitId" TEXT,
    "prompt" TEXT,
    "result" TEXT,
    "confidence" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'AI_SUGGESTED',
    "reviewedByDoctorId" TEXT,
    "doctorFeedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiDiagnosis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalConclusion" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "aiDiagnosisId" TEXT,
    "finalDiagnosis" TEXT NOT NULL,
    "treatmentPlan" TEXT,
    "prescription" TEXT,
    "followUpNote" TEXT,
    "doctorNote" TEXT,
    "concludedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "hash256" TEXT,
    "dataSalt" TEXT,

    CONSTRAINT "MedicalConclusion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiQuality" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "aiModelId" TEXT NOT NULL,
    "aiDiagnosisId" TEXT,
    "doctorConclusionAboutModel" TEXT NOT NULL,
    "trustablePercent" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "hash256" TEXT,
    "dataSalt" TEXT,

    CONSTRAINT "AiQuality_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockchainLogger" (
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
    "onChainStatus" TEXT DEFAULT 'PENDING',
    "txHash" TEXT,
    "blockNumber" INTEGER,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockchainLogger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditBatch" (
    "id" TEXT NOT NULL,
    "batchId" INTEGER NOT NULL,
    "merkleRoot" TEXT NOT NULL,
    "leafCount" INTEGER NOT NULL,
    "fromSeq" INTEGER,
    "toSeq" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PREPARING',
    "algorithmVersion" TEXT NOT NULL DEFAULT 'MERKLE_SHA256_STRING_V1',
    "contractVersion" TEXT,
    "artifactHash" TEXT,
    "artifactUri" TEXT,
    "artifactCid" TEXT,
    "artifactKeyId" TEXT,
    "txHash" TEXT,
    "blockNumber" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "anchoredAt" TIMESTAMP(3),
    "recoveredAt" TIMESTAMP(3),

    CONSTRAINT "AuditBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditRecovery" (
    "id" TEXT NOT NULL,
    "batchId" INTEGER NOT NULL,
    "requestedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'STARTED',
    "restoredCount" INTEGER NOT NULL DEFAULT 0,
    "artifactHash" TEXT,
    "merkleRoot" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AuditRecovery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceId" TEXT,
    "deviceName" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpVerification" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "phoneNormalized" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL DEFAULT 'PATIENT_LOGIN',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "sentAt" TIMESTAMP(3),
    "blockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneNormalized_key" ON "User"("phoneNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "User_inviteToken_key" ON "User"("inviteToken");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Department_departmentCode_key" ON "Department"("departmentCode");

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Department_managerId_key" ON "Department"("managerId");

-- CreateIndex
CREATE INDEX "Department_status_idx" ON "Department"("status");

-- CreateIndex
CREATE INDEX "Department_type_idx" ON "Department"("type");

-- CreateIndex
CREATE INDEX "Department_canReceiveOrders_idx" ON "Department"("canReceiveOrders");

-- CreateIndex
CREATE INDEX "Department_deletedAt_idx" ON "Department"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StaffProfile_userId_key" ON "StaffProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffProfile_citizenId_key" ON "StaffProfile"("citizenId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffProfile_employeeCode_key" ON "StaffProfile"("employeeCode");

-- CreateIndex
CREATE INDEX "StaffProfile_departmentId_idx" ON "StaffProfile"("departmentId");

-- CreateIndex
CREATE INDEX "StaffProfile_fullName_idx" ON "StaffProfile"("fullName");

-- CreateIndex
CREATE INDEX "StaffProfile_labSpecialty_idx" ON "StaffProfile"("labSpecialty");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorProfile_staffProfileId_key" ON "DoctorProfile"("staffProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorProfile_licenseNumber_key" ON "DoctorProfile"("licenseNumber");

-- CreateIndex
CREATE INDEX "DoctorProfile_specialty_idx" ON "DoctorProfile"("specialty");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_patientCode_key" ON "Patient"("patientCode");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_citizenId_key" ON "Patient"("citizenId");

-- CreateIndex
CREATE INDEX "Patient_fullName_idx" ON "Patient"("fullName");

-- CreateIndex
CREATE INDEX "Patient_citizenId_idx" ON "Patient"("citizenId");

-- CreateIndex
CREATE INDEX "Patient_contactPhone_idx" ON "Patient"("contactPhone");

-- CreateIndex
CREATE INDEX "PatientAccess_userId_idx" ON "PatientAccess"("userId");

-- CreateIndex
CREATE INDEX "PatientAccess_patientId_idx" ON "PatientAccess"("patientId");

-- CreateIndex
CREATE INDEX "PatientAccess_status_idx" ON "PatientAccess"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PatientAccess_userId_patientId_key" ON "PatientAccess"("userId", "patientId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminProfile_userId_key" ON "AdminProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminProfile_adminUserName_key" ON "AdminProfile"("adminUserName");

-- CreateIndex
CREATE UNIQUE INDEX "AdminProfile_walletAddress_key" ON "AdminProfile"("walletAddress");

-- CreateIndex
CREATE INDEX "AdminProfile_walletAddress_idx" ON "AdminProfile"("walletAddress");

-- CreateIndex
CREATE INDEX "AdminProfile_noncePurpose_nonceExpiresAt_idx" ON "AdminProfile"("noncePurpose", "nonceExpiresAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE UNIQUE INDEX "Visit_visitCode_key" ON "Visit"("visitCode");

-- CreateIndex
CREATE INDEX "Visit_patientId_idx" ON "Visit"("patientId");

-- CreateIndex
CREATE INDEX "Visit_departmentId_idx" ON "Visit"("departmentId");

-- CreateIndex
CREATE INDEX "Visit_staffId_idx" ON "Visit"("staffId");

-- CreateIndex
CREATE INDEX "Visit_status_idx" ON "Visit"("status");

-- CreateIndex
CREATE INDEX "Visit_source_idx" ON "Visit"("source");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_appointmentCode_key" ON "Appointment"("appointmentCode");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_qrTokenHash_key" ON "Appointment"("qrTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_visitId_key" ON "Appointment"("visitId");

-- CreateIndex
CREATE INDEX "Appointment_patientId_idx" ON "Appointment"("patientId");

-- CreateIndex
CREATE INDEX "Appointment_departmentId_idx" ON "Appointment"("departmentId");

-- CreateIndex
CREATE INDEX "Appointment_doctorId_idx" ON "Appointment"("doctorId");

-- CreateIndex
CREATE INDEX "Appointment_scheduledAt_idx" ON "Appointment"("scheduledAt");

-- CreateIndex
CREATE INDEX "Appointment_status_idx" ON "Appointment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MedicalOrder_orderCode_key" ON "MedicalOrder"("orderCode");

-- CreateIndex
CREATE INDEX "MedicalOrder_visitId_idx" ON "MedicalOrder"("visitId");

-- CreateIndex
CREATE INDEX "MedicalOrder_patientId_idx" ON "MedicalOrder"("patientId");

-- CreateIndex
CREATE INDEX "MedicalOrder_doctorId_idx" ON "MedicalOrder"("doctorId");

-- CreateIndex
CREATE INDEX "MedicalOrder_targetDepartmentId_idx" ON "MedicalOrder"("targetDepartmentId");

-- CreateIndex
CREATE INDEX "MedicalOrder_status_idx" ON "MedicalOrder"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MedicalResult_resultCode_key" ON "MedicalResult"("resultCode");

-- CreateIndex
CREATE INDEX "MedicalResult_orderId_idx" ON "MedicalResult"("orderId");

-- CreateIndex
CREATE INDEX "MedicalResult_performedById_idx" ON "MedicalResult"("performedById");

-- CreateIndex
CREATE INDEX "MedicalResultFile_resultId_idx" ON "MedicalResultFile"("resultId");

-- CreateIndex
CREATE INDEX "MedicalResultFile_storageProvider_idx" ON "MedicalResultFile"("storageProvider");

-- CreateIndex
CREATE UNIQUE INDEX "AiModelRegistry_modelId_key" ON "AiModelRegistry"("modelId");

-- CreateIndex
CREATE INDEX "AiModelRegistry_modelId_idx" ON "AiModelRegistry"("modelId");

-- CreateIndex
CREATE INDEX "AiModelRegistry_isActiveOnChain_idx" ON "AiModelRegistry"("isActiveOnChain");

-- CreateIndex
CREATE INDEX "AiModelRegistry_status_idx" ON "AiModelRegistry"("status");

-- CreateIndex
CREATE INDEX "AiModelRegistry_isDeleted_idx" ON "AiModelRegistry"("isDeleted");

-- CreateIndex
CREATE INDEX "AiModelRegistry_type_idx" ON "AiModelRegistry"("type");

-- CreateIndex
CREATE INDEX "AiModelRegistry_provider_idx" ON "AiModelRegistry"("provider");

-- CreateIndex
CREATE INDEX "AiModelRegistry_deletedAt_idx" ON "AiModelRegistry"("deletedAt");

-- CreateIndex
CREATE INDEX "AiDiagnosis_aiModelId_idx" ON "AiDiagnosis"("aiModelId");

-- CreateIndex
CREATE INDEX "AiDiagnosis_patientId_idx" ON "AiDiagnosis"("patientId");

-- CreateIndex
CREATE INDEX "AiDiagnosis_visitId_idx" ON "AiDiagnosis"("visitId");

-- CreateIndex
CREATE INDEX "AiDiagnosis_reviewedByDoctorId_idx" ON "AiDiagnosis"("reviewedByDoctorId");

-- CreateIndex
CREATE UNIQUE INDEX "MedicalConclusion_visitId_key" ON "MedicalConclusion"("visitId");

-- CreateIndex
CREATE INDEX "MedicalConclusion_doctorId_idx" ON "MedicalConclusion"("doctorId");

-- CreateIndex
CREATE INDEX "MedicalConclusion_aiDiagnosisId_idx" ON "MedicalConclusion"("aiDiagnosisId");

-- CreateIndex
CREATE UNIQUE INDEX "AiQuality_aiDiagnosisId_key" ON "AiQuality"("aiDiagnosisId");

-- CreateIndex
CREATE INDEX "AiQuality_doctorId_idx" ON "AiQuality"("doctorId");

-- CreateIndex
CREATE INDEX "AiQuality_aiModelId_idx" ON "AiQuality"("aiModelId");

-- CreateIndex
CREATE UNIQUE INDEX "BlockchainLogger_eventId_key" ON "BlockchainLogger"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "BlockchainLogger_seq_key" ON "BlockchainLogger"("seq");

-- CreateIndex
CREATE INDEX "BlockchainLogger_actorId_idx" ON "BlockchainLogger"("actorId");

-- CreateIndex
CREATE INDEX "BlockchainLogger_entity_entityId_idx" ON "BlockchainLogger"("entity", "entityId");

-- CreateIndex
CREATE INDEX "BlockchainLogger_action_idx" ON "BlockchainLogger"("action");

-- CreateIndex
CREATE INDEX "BlockchainLogger_departmentId_idx" ON "BlockchainLogger"("departmentId");

-- CreateIndex
CREATE INDEX "BlockchainLogger_staffProfileId_idx" ON "BlockchainLogger"("staffProfileId");

-- CreateIndex
CREATE INDEX "BlockchainLogger_doctorProfileId_idx" ON "BlockchainLogger"("doctorProfileId");

-- CreateIndex
CREATE INDEX "BlockchainLogger_patientId_idx" ON "BlockchainLogger"("patientId");

-- CreateIndex
CREATE INDEX "BlockchainLogger_aiModelRegistryId_idx" ON "BlockchainLogger"("aiModelRegistryId");

-- CreateIndex
CREATE INDEX "BlockchainLogger_medicalConclusionId_idx" ON "BlockchainLogger"("medicalConclusionId");

-- CreateIndex
CREATE INDEX "BlockchainLogger_aiQualityId_idx" ON "BlockchainLogger"("aiQualityId");

-- CreateIndex
CREATE INDEX "BlockchainLogger_batchId_idx" ON "BlockchainLogger"("batchId");

-- CreateIndex
CREATE INDEX "BlockchainLogger_onChainStatus_idx" ON "BlockchainLogger"("onChainStatus");

-- CreateIndex
CREATE INDEX "BlockchainLogger_hashVersion_idx" ON "BlockchainLogger"("hashVersion");

-- CreateIndex
CREATE UNIQUE INDEX "AuditBatch_batchId_key" ON "AuditBatch"("batchId");

-- CreateIndex
CREATE INDEX "AuditBatch_status_idx" ON "AuditBatch"("status");

-- CreateIndex
CREATE INDEX "AuditBatch_algorithmVersion_idx" ON "AuditBatch"("algorithmVersion");

-- CreateIndex
CREATE INDEX "AuditBatch_createdAt_idx" ON "AuditBatch"("createdAt");

-- CreateIndex
CREATE INDEX "AuditRecovery_batchId_createdAt_idx" ON "AuditRecovery"("batchId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditRecovery_requestedById_createdAt_idx" ON "AuditRecovery"("requestedById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE INDEX "RefreshToken_revokedAt_idx" ON "RefreshToken"("revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OtpVerification_requestId_key" ON "OtpVerification"("requestId");

-- CreateIndex
CREATE INDEX "OtpVerification_phoneNormalized_purpose_createdAt_idx" ON "OtpVerification"("phoneNormalized", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "OtpVerification_expiresAt_idx" ON "OtpVerification"("expiresAt");

-- CreateIndex
CREATE INDEX "OtpVerification_usedAt_idx" ON "OtpVerification"("usedAt");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_deletedBy_fkey" FOREIGN KEY ("deletedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "StaffProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_deletedBy_fkey" FOREIGN KEY ("deletedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorProfile" ADD CONSTRAINT "DoctorProfile_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientAccess" ADD CONSTRAINT "PatientAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientAccess" ADD CONSTRAINT "PatientAccess_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientAccess" ADD CONSTRAINT "PatientAccess_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminProfile" ADD CONSTRAINT "AdminProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalOrder" ADD CONSTRAINT "MedicalOrder_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalOrder" ADD CONSTRAINT "MedicalOrder_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalOrder" ADD CONSTRAINT "MedicalOrder_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalOrder" ADD CONSTRAINT "MedicalOrder_targetDepartmentId_fkey" FOREIGN KEY ("targetDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalResult" ADD CONSTRAINT "MedicalResult_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MedicalOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalResult" ADD CONSTRAINT "MedicalResult_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalResultFile" ADD CONSTRAINT "MedicalResultFile_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "MedicalResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiModelRegistry" ADD CONSTRAINT "AiModelRegistry_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiModelRegistry" ADD CONSTRAINT "AiModelRegistry_deletedBy_fkey" FOREIGN KEY ("deletedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiDiagnosis" ADD CONSTRAINT "AiDiagnosis_aiModelId_fkey" FOREIGN KEY ("aiModelId") REFERENCES "AiModelRegistry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiDiagnosis" ADD CONSTRAINT "AiDiagnosis_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiDiagnosis" ADD CONSTRAINT "AiDiagnosis_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiDiagnosis" ADD CONSTRAINT "AiDiagnosis_reviewedByDoctorId_fkey" FOREIGN KEY ("reviewedByDoctorId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalConclusion" ADD CONSTRAINT "MedicalConclusion_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalConclusion" ADD CONSTRAINT "MedicalConclusion_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalConclusion" ADD CONSTRAINT "MedicalConclusion_aiDiagnosisId_fkey" FOREIGN KEY ("aiDiagnosisId") REFERENCES "AiDiagnosis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiQuality" ADD CONSTRAINT "AiQuality_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "AiQuality" ADD CONSTRAINT "AiQuality_aiModelId_fkey" FOREIGN KEY ("aiModelId") REFERENCES "AiModelRegistry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiQuality" ADD CONSTRAINT "AiQuality_aiDiagnosisId_fkey" FOREIGN KEY ("aiDiagnosisId") REFERENCES "AiDiagnosis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockchainLogger" ADD CONSTRAINT "BlockchainLogger_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockchainLogger" ADD CONSTRAINT "BlockchainLogger_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "AuditBatch"("batchId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockchainLogger" ADD CONSTRAINT "BlockchainLogger_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockchainLogger" ADD CONSTRAINT "BlockchainLogger_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockchainLogger" ADD CONSTRAINT "BlockchainLogger_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockchainLogger" ADD CONSTRAINT "BlockchainLogger_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockchainLogger" ADD CONSTRAINT "BlockchainLogger_aiModelRegistryId_fkey" FOREIGN KEY ("aiModelRegistryId") REFERENCES "AiModelRegistry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockchainLogger" ADD CONSTRAINT "BlockchainLogger_medicalConclusionId_fkey" FOREIGN KEY ("medicalConclusionId") REFERENCES "MedicalConclusion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockchainLogger" ADD CONSTRAINT "BlockchainLogger_aiQualityId_fkey" FOREIGN KEY ("aiQualityId") REFERENCES "AiQuality"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditRecovery" ADD CONSTRAINT "AuditRecovery_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "AuditBatch"("batchId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditRecovery" ADD CONSTRAINT "AuditRecovery_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Append-only trigger for BlockchainLogger
CREATE OR REPLACE FUNCTION "blockchain_logger_append_only"()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    RAISE EXCEPTION 'BlockchainLogger is append-only: DELETE is forbidden (seq=%).', OLD."seq";
  END IF;

  IF (TG_OP = 'UPDATE') THEN
    IF NEW."id"                 IS DISTINCT FROM OLD."id"                 OR
       NEW."actorId"            IS DISTINCT FROM OLD."actorId"            OR
       NEW."action"             IS DISTINCT FROM OLD."action"             OR
       NEW."entity"             IS DISTINCT FROM OLD."entity"             OR
       NEW."entityId"           IS DISTINCT FROM OLD."entityId"           OR
       NEW."metadata"           IS DISTINCT FROM OLD."metadata"           OR
       NEW."dataHash"           IS DISTINCT FROM OLD."dataHash"           OR
       NEW."dataSalt"           IS DISTINCT FROM OLD."dataSalt"           OR
       NEW."beforeJson"         IS DISTINCT FROM OLD."beforeJson"         OR
       NEW."afterJson"          IS DISTINCT FROM OLD."afterJson"          OR
       NEW."beforeHash"         IS DISTINCT FROM OLD."beforeHash"         OR
       NEW."afterHash"          IS DISTINCT FROM OLD."afterHash"          OR
       NEW."diffHash"           IS DISTINCT FROM OLD."diffHash"           OR
       NEW."hashVersion"        IS DISTINCT FROM OLD."hashVersion"        OR
       NEW."beforeEncrypted"    IS DISTINCT FROM OLD."beforeEncrypted"    OR
       NEW."afterEncrypted"     IS DISTINCT FROM OLD."afterEncrypted"     OR
       NEW."encryptionVersion"  IS DISTINCT FROM OLD."encryptionVersion"  OR
       NEW."encryptionKeyId"    IS DISTINCT FROM OLD."encryptionKeyId"    OR
       NEW."diffJson"           IS DISTINCT FROM OLD."diffJson"           OR
       NEW."fieldsChanged"      IS DISTINCT FROM OLD."fieldsChanged"      OR
       NEW."departmentId"       IS DISTINCT FROM OLD."departmentId"       OR
       NEW."staffProfileId"     IS DISTINCT FROM OLD."staffProfileId"     OR
       NEW."doctorProfileId"    IS DISTINCT FROM OLD."doctorProfileId"    OR
       NEW."patientId"          IS DISTINCT FROM OLD."patientId"          OR
       NEW."aiModelRegistryId"  IS DISTINCT FROM OLD."aiModelRegistryId"  OR
       NEW."medicalConclusionId" IS DISTINCT FROM OLD."medicalConclusionId" OR
       NEW."aiQualityId"        IS DISTINCT FROM OLD."aiQualityId"        OR
       NEW."seq"                IS DISTINCT FROM OLD."seq"                OR
       NEW."prevHash"           IS DISTINCT FROM OLD."prevHash"           OR
       NEW."entryHash"          IS DISTINCT FROM OLD."entryHash"          OR
       NEW."createdAt"          IS DISTINCT FROM OLD."createdAt"
    THEN
      RAISE EXCEPTION 'BlockchainLogger is append-only: content columns are immutable (seq=%). Only one-way anchoring metadata may change.', OLD."seq";
    END IF;

    IF OLD."batchId" IS NOT NULL AND NEW."batchId" IS DISTINCT FROM OLD."batchId" THEN
      RAISE EXCEPTION 'BlockchainLogger anchoring metadata is immutable: batchId already set (seq=%).', OLD."seq";
    END IF;
    IF OLD."txHash" IS NOT NULL AND NEW."txHash" IS DISTINCT FROM OLD."txHash" THEN
      RAISE EXCEPTION 'BlockchainLogger anchoring metadata is immutable: txHash already set (seq=%).', OLD."seq";
    END IF;
    IF OLD."blockNumber" IS NOT NULL AND NEW."blockNumber" IS DISTINCT FROM OLD."blockNumber" THEN
      RAISE EXCEPTION 'BlockchainLogger anchoring metadata is immutable: blockNumber already set (seq=%).', OLD."seq";
    END IF;
    IF OLD."onChainStatus" = 'ANCHORED' AND NEW."onChainStatus" IS DISTINCT FROM OLD."onChainStatus" THEN
      RAISE EXCEPTION 'BlockchainLogger anchored status is immutable (seq=%).', OLD."seq";
    END IF;
    IF OLD."onChainStatus" IS DISTINCT FROM NEW."onChainStatus"
       AND NOT (OLD."onChainStatus" = 'PENDING' AND NEW."onChainStatus" IN ('ANCHORED', 'FAILED', 'UNANCHORED'))
    THEN
      RAISE EXCEPTION 'BlockchainLogger invalid onChainStatus transition from % to % (seq=%).', OLD."onChainStatus", NEW."onChainStatus", OLD."seq";
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_blockchain_logger_append_only" ON "BlockchainLogger";
CREATE TRIGGER "trg_blockchain_logger_append_only"
  BEFORE UPDATE OR DELETE ON "BlockchainLogger"
  FOR EACH ROW EXECUTE FUNCTION "blockchain_logger_append_only"();


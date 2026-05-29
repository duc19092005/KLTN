-- CreateEnum
CREATE TYPE "MedicalOrderStatus" AS ENUM ('ORDERED', 'IN_PROGRESS', 'RESULT_READY', 'COMPLETED', 'CANCELLED');

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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiModelRegistry_pkey" PRIMARY KEY ("id")
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
    "resultSummary" TEXT NOT NULL,
    "resultData" JSONB,
    "attachmentUrl" TEXT,
    "conclusion" TEXT,
    "returnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalResult_pkey" PRIMARY KEY ("id")
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

    CONSTRAINT "MedicalConclusion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiQuality" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "aiModelId" TEXT NOT NULL,
    "doctorConclusionAboutModel" TEXT NOT NULL,
    "trustablePercent" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiQuality_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiModelRegistry_modelId_key" ON "AiModelRegistry"("modelId");
CREATE INDEX "AiModelRegistry_modelId_idx" ON "AiModelRegistry"("modelId");
CREATE INDEX "AiModelRegistry_isActiveOnChain_idx" ON "AiModelRegistry"("isActiveOnChain");
CREATE INDEX "AiModelRegistry_type_idx" ON "AiModelRegistry"("type");
CREATE INDEX "AiModelRegistry_provider_idx" ON "AiModelRegistry"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "MedicalOrder_orderCode_key" ON "MedicalOrder"("orderCode");
CREATE INDEX "MedicalOrder_visitId_idx" ON "MedicalOrder"("visitId");
CREATE INDEX "MedicalOrder_patientId_idx" ON "MedicalOrder"("patientId");
CREATE INDEX "MedicalOrder_doctorId_idx" ON "MedicalOrder"("doctorId");
CREATE INDEX "MedicalOrder_targetDepartmentId_idx" ON "MedicalOrder"("targetDepartmentId");
CREATE INDEX "MedicalOrder_status_idx" ON "MedicalOrder"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MedicalResult_resultCode_key" ON "MedicalResult"("resultCode");
CREATE INDEX "MedicalResult_orderId_idx" ON "MedicalResult"("orderId");
CREATE INDEX "MedicalResult_performedById_idx" ON "MedicalResult"("performedById");

-- CreateIndex
CREATE INDEX "AiDiagnosis_aiModelId_idx" ON "AiDiagnosis"("aiModelId");
CREATE INDEX "AiDiagnosis_patientId_idx" ON "AiDiagnosis"("patientId");
CREATE INDEX "AiDiagnosis_visitId_idx" ON "AiDiagnosis"("visitId");
CREATE INDEX "AiDiagnosis_reviewedByDoctorId_idx" ON "AiDiagnosis"("reviewedByDoctorId");

-- CreateIndex
CREATE UNIQUE INDEX "MedicalConclusion_visitId_key" ON "MedicalConclusion"("visitId");
CREATE INDEX "MedicalConclusion_doctorId_idx" ON "MedicalConclusion"("doctorId");
CREATE INDEX "MedicalConclusion_aiDiagnosisId_idx" ON "MedicalConclusion"("aiDiagnosisId");

-- CreateIndex
CREATE INDEX "AiQuality_doctorId_idx" ON "AiQuality"("doctorId");
CREATE INDEX "AiQuality_aiModelId_idx" ON "AiQuality"("aiModelId");

-- AddForeignKey
ALTER TABLE "MedicalOrder" ADD CONSTRAINT "MedicalOrder_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MedicalOrder" ADD CONSTRAINT "MedicalOrder_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MedicalOrder" ADD CONSTRAINT "MedicalOrder_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MedicalOrder" ADD CONSTRAINT "MedicalOrder_targetDepartmentId_fkey" FOREIGN KEY ("targetDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalResult" ADD CONSTRAINT "MedicalResult_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MedicalOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MedicalResult" ADD CONSTRAINT "MedicalResult_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiDiagnosis" ADD CONSTRAINT "AiDiagnosis_aiModelId_fkey" FOREIGN KEY ("aiModelId") REFERENCES "AiModelRegistry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiDiagnosis" ADD CONSTRAINT "AiDiagnosis_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiDiagnosis" ADD CONSTRAINT "AiDiagnosis_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiDiagnosis" ADD CONSTRAINT "AiDiagnosis_reviewedByDoctorId_fkey" FOREIGN KEY ("reviewedByDoctorId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalConclusion" ADD CONSTRAINT "MedicalConclusion_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MedicalConclusion" ADD CONSTRAINT "MedicalConclusion_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MedicalConclusion" ADD CONSTRAINT "MedicalConclusion_aiDiagnosisId_fkey" FOREIGN KEY ("aiDiagnosisId") REFERENCES "AiDiagnosis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiQuality" ADD CONSTRAINT "AiQuality_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "AiQuality" ADD CONSTRAINT "AiQuality_aiModelId_fkey" FOREIGN KEY ("aiModelId") REFERENCES "AiModelRegistry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

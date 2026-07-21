ALTER TABLE "AiQuality" ADD COLUMN "aiDiagnosisId" TEXT;
CREATE UNIQUE INDEX "AiQuality_aiDiagnosisId_key" ON "AiQuality"("aiDiagnosisId");
ALTER TABLE "AiQuality" ADD CONSTRAINT "AiQuality_aiDiagnosisId_fkey" FOREIGN KEY ("aiDiagnosisId") REFERENCES "AiDiagnosis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add local tamper-evidence columns to the clinical workflow entities.
ALTER TABLE "Visit" ADD COLUMN "hash256" TEXT, ADD COLUMN "dataSalt" TEXT;
ALTER TABLE "MedicalOrder" ADD COLUMN "hash256" TEXT, ADD COLUMN "dataSalt" TEXT;
ALTER TABLE "MedicalResult" ADD COLUMN "hash256" TEXT, ADD COLUMN "dataSalt" TEXT;

-- Link immutable audit entries to their clinical entities. Columns remain nullable
-- so existing audit history and business rows require no destructive backfill.
ALTER TABLE "BlockchainLogger"
  ADD COLUMN "visitId" TEXT,
  ADD COLUMN "medicalOrderId" TEXT,
  ADD COLUMN "medicalResultId" TEXT;

CREATE INDEX "BlockchainLogger_visitId_idx" ON "BlockchainLogger"("visitId");
CREATE INDEX "BlockchainLogger_medicalOrderId_idx" ON "BlockchainLogger"("medicalOrderId");
CREATE INDEX "BlockchainLogger_medicalResultId_idx" ON "BlockchainLogger"("medicalResultId");

ALTER TABLE "BlockchainLogger"
  ADD CONSTRAINT "BlockchainLogger_visitId_fkey"
    FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "BlockchainLogger_medicalOrderId_fkey"
    FOREIGN KEY ("medicalOrderId") REFERENCES "MedicalOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "BlockchainLogger_medicalResultId_fkey"
    FOREIGN KEY ("medicalResultId") REFERENCES "MedicalResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

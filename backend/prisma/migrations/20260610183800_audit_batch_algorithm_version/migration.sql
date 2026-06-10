-- Add algorithm/version metadata so historical v1 Merkle roots and future v2 roots can coexist.
ALTER TABLE "AuditBatch"
  ADD COLUMN IF NOT EXISTS "algorithmVersion" TEXT NOT NULL DEFAULT 'MERKLE_SHA256_STRING_V1',
  ADD COLUMN IF NOT EXISTS "contractVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "recoveredAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "AuditBatch_algorithmVersion_idx" ON "AuditBatch"("algorithmVersion");

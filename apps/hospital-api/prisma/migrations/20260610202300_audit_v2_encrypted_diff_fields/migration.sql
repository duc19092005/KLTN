-- Blockchain Audit V2 encrypted-diff fields.
-- Existing V1 rows remain compatible: new columns are nullable and populated only by V2 writers.

ALTER TABLE "BlockchainLogger"
  ADD COLUMN IF NOT EXISTS "beforeHash" TEXT,
  ADD COLUMN IF NOT EXISTS "afterHash" TEXT,
  ADD COLUMN IF NOT EXISTS "diffHash" TEXT,
  ADD COLUMN IF NOT EXISTS "hashVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "beforeEncrypted" JSONB,
  ADD COLUMN IF NOT EXISTS "afterEncrypted" JSONB,
  ADD COLUMN IF NOT EXISTS "encryptionVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "encryptionKeyId" TEXT,
  ADD COLUMN IF NOT EXISTS "diffJson" JSONB,
  ADD COLUMN IF NOT EXISTS "fieldsChanged" JSONB;

CREATE INDEX IF NOT EXISTS "BlockchainLogger_hashVersion_idx"
  ON "BlockchainLogger"("hashVersion");

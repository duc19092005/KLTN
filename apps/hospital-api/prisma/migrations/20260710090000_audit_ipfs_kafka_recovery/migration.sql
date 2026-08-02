ALTER TABLE "BlockchainLogger" ADD COLUMN IF NOT EXISTS "eventId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "BlockchainLogger_eventId_key" ON "BlockchainLogger"("eventId");

ALTER TABLE "AuditBatch" ALTER COLUMN "status" SET DEFAULT 'PREPARING';
ALTER TABLE "AuditBatch" ADD COLUMN IF NOT EXISTS "artifactHash" TEXT;
ALTER TABLE "AuditBatch" ADD COLUMN IF NOT EXISTS "artifactUri" TEXT;
ALTER TABLE "AuditBatch" ADD COLUMN IF NOT EXISTS "artifactCid" TEXT;
ALTER TABLE "AuditBatch" ADD COLUMN IF NOT EXISTS "artifactKeyId" TEXT;

CREATE TABLE IF NOT EXISTS "AuditOutbox" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "auditLogId" TEXT NOT NULL,
  "topic" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuditOutbox_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AuditOutbox_eventId_key" ON "AuditOutbox"("eventId");
CREATE UNIQUE INDEX IF NOT EXISTS "AuditOutbox_auditLogId_key" ON "AuditOutbox"("auditLogId");
CREATE INDEX IF NOT EXISTS "AuditOutbox_status_createdAt_idx" ON "AuditOutbox"("status", "createdAt");

CREATE TABLE IF NOT EXISTS "AuditKafkaReceipt" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "auditLogId" TEXT NOT NULL,
  "topic" TEXT NOT NULL,
  "partition" INTEGER NOT NULL,
  "offset" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditKafkaReceipt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AuditKafkaReceipt_eventId_key" ON "AuditKafkaReceipt"("eventId");
CREATE INDEX IF NOT EXISTS "AuditKafkaReceipt_auditLogId_idx" ON "AuditKafkaReceipt"("auditLogId");

CREATE TABLE IF NOT EXISTS "AuditRecovery" (
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
CREATE INDEX IF NOT EXISTS "AuditRecovery_batchId_createdAt_idx" ON "AuditRecovery"("batchId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditRecovery_requestedById_createdAt_idx" ON "AuditRecovery"("requestedById", "createdAt");

CREATE TABLE IF NOT EXISTS "AuditRecoveryStageRow" (
  "id" TEXT NOT NULL,
  "recoveryId" TEXT NOT NULL,
  "seq" INTEGER NOT NULL,
  "entryHash" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditRecoveryStageRow_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AuditRecoveryStageRow_recoveryId_seq_key" ON "AuditRecoveryStageRow"("recoveryId", "seq");
CREATE INDEX IF NOT EXISTS "AuditRecoveryStageRow_recoveryId_idx" ON "AuditRecoveryStageRow"("recoveryId");

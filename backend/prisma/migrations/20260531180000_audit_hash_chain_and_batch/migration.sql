-- ============================================================================
-- Audit hash-chain + Merkle batch anchoring
-- ----------------------------------------------------------------------------
-- Adds tamper-evident chaining columns to BlockchainLogger, the AuditBatch table
-- recording each on-chain Merkle checkpoint, and an append-only trigger that makes
-- audit log CONTENT immutable at the database layer (only anchoring metadata may
-- be updated; rows may never be deleted).
-- ============================================================================

-- 1. Hash-chain + batch columns on the centralized logger ---------------------
ALTER TABLE "BlockchainLogger"
  ADD COLUMN IF NOT EXISTS "seq"       INTEGER,
  ADD COLUMN IF NOT EXISTS "prevHash"  TEXT,
  ADD COLUMN IF NOT EXISTS "entryHash" TEXT,
  ADD COLUMN IF NOT EXISTS "batchId"   INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS "BlockchainLogger_seq_key" ON "BlockchainLogger"("seq");
CREATE INDEX IF NOT EXISTS "BlockchainLogger_batchId_idx" ON "BlockchainLogger"("batchId");
CREATE INDEX IF NOT EXISTS "BlockchainLogger_onChainStatus_idx" ON "BlockchainLogger"("onChainStatus");

-- 2. AuditBatch: one row per committed Merkle checkpoint ----------------------
CREATE TABLE IF NOT EXISTS "AuditBatch" (
  "id"          TEXT NOT NULL,
  "batchId"     INTEGER NOT NULL,
  "merkleRoot"  TEXT NOT NULL,
  "leafCount"   INTEGER NOT NULL,
  "fromSeq"     INTEGER,
  "toSeq"       INTEGER,
  "status"      TEXT NOT NULL DEFAULT 'PENDING',
  "txHash"      TEXT,
  "blockNumber" INTEGER,
  "error"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "anchoredAt"  TIMESTAMP(3),
  CONSTRAINT "AuditBatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AuditBatch_batchId_key" ON "AuditBatch"("batchId");
CREATE INDEX IF NOT EXISTS "AuditBatch_status_idx" ON "AuditBatch"("status");
CREATE INDEX IF NOT EXISTS "AuditBatch_createdAt_idx" ON "AuditBatch"("createdAt");

-- 3. Append-only enforcement --------------------------------------------------
-- DELETE is always forbidden. UPDATE is allowed ONLY on the anchoring metadata
-- columns (onChainStatus, txHash, blockNumber, batchId); any attempt to mutate a
-- content column (actor/action/entity/snapshot/hash-chain) is rejected. This makes
-- "edit a past log" impossible without superuser rights to DROP this trigger -- which
-- is exactly the residual risk the on-chain Merkle anchor is designed to expose.
CREATE OR REPLACE FUNCTION "blockchain_logger_append_only"()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    RAISE EXCEPTION 'BlockchainLogger is append-only: DELETE is forbidden (seq=%).', OLD."seq";
  END IF;

  IF (TG_OP = 'UPDATE') THEN
    IF NEW."id"         IS DISTINCT FROM OLD."id"         OR
       NEW."actorId"    IS DISTINCT FROM OLD."actorId"    OR
       NEW."action"     IS DISTINCT FROM OLD."action"     OR
       NEW."entity"     IS DISTINCT FROM OLD."entity"     OR
       NEW."entityId"   IS DISTINCT FROM OLD."entityId"   OR
       NEW."metadata"   IS DISTINCT FROM OLD."metadata"   OR
       NEW."dataHash"   IS DISTINCT FROM OLD."dataHash"   OR
       NEW."dataSalt"   IS DISTINCT FROM OLD."dataSalt"   OR
       NEW."beforeJson" IS DISTINCT FROM OLD."beforeJson" OR
       NEW."afterJson"  IS DISTINCT FROM OLD."afterJson"  OR
       NEW."seq"        IS DISTINCT FROM OLD."seq"        OR
       NEW."prevHash"   IS DISTINCT FROM OLD."prevHash"   OR
       NEW."entryHash"  IS DISTINCT FROM OLD."entryHash"  OR
       NEW."createdAt"  IS DISTINCT FROM OLD."createdAt"
    THEN
      RAISE EXCEPTION 'BlockchainLogger is append-only: content columns are immutable (seq=%). Only anchoring metadata (onChainStatus, txHash, blockNumber, batchId) may change.', OLD."seq";
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_blockchain_logger_append_only" ON "BlockchainLogger";
CREATE TRIGGER "trg_blockchain_logger_append_only"
  BEFORE UPDATE OR DELETE ON "BlockchainLogger"
  FOR EACH ROW EXECUTE FUNCTION "blockchain_logger_append_only"();

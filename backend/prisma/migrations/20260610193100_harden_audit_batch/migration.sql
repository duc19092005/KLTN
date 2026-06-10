-- ============================================================================
-- Harden AuditBatch immutability and anchored range integrity
-- ----------------------------------------------------------------------------
-- AuditBatch rows describe on-chain Merkle checkpoints. Root/range/version fields
-- must never change after creation, and anchored ranges must not overlap.
-- ============================================================================

CREATE OR REPLACE FUNCTION "audit_batch_immutable"()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    RAISE EXCEPTION 'AuditBatch is immutable: DELETE is forbidden (batchId=%).', OLD."batchId";
  END IF;

  IF (TG_OP = 'UPDATE') THEN
    IF NEW."id" IS DISTINCT FROM OLD."id" OR
       NEW."batchId" IS DISTINCT FROM OLD."batchId" OR
       NEW."merkleRoot" IS DISTINCT FROM OLD."merkleRoot" OR
       NEW."leafCount" IS DISTINCT FROM OLD."leafCount" OR
       NEW."fromSeq" IS DISTINCT FROM OLD."fromSeq" OR
       NEW."toSeq" IS DISTINCT FROM OLD."toSeq" OR
       NEW."algorithmVersion" IS DISTINCT FROM OLD."algorithmVersion" OR
       NEW."contractVersion" IS DISTINCT FROM OLD."contractVersion" OR
       NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
    THEN
      RAISE EXCEPTION 'AuditBatch immutable checkpoint fields cannot be changed (batchId=%).', OLD."batchId";
    END IF;

    IF OLD."status" = 'ANCHORED' AND NEW."status" IS DISTINCT FROM OLD."status" THEN
      RAISE EXCEPTION 'AuditBatch anchored status is immutable (batchId=%).', OLD."batchId";
    END IF;

    IF OLD."status" IS DISTINCT FROM NEW."status"
       AND NOT (OLD."status" = 'PENDING' AND NEW."status" IN ('ANCHORED', 'FAILED'))
    THEN
      RAISE EXCEPTION 'Invalid AuditBatch status transition from % to % (batchId=%).', OLD."status", NEW."status", OLD."batchId";
    END IF;

    IF OLD."txHash" IS NOT NULL AND NEW."txHash" IS DISTINCT FROM OLD."txHash" THEN
      RAISE EXCEPTION 'AuditBatch txHash is immutable once set (batchId=%).', OLD."batchId";
    END IF;
    IF OLD."blockNumber" IS NOT NULL AND NEW."blockNumber" IS DISTINCT FROM OLD."blockNumber" THEN
      RAISE EXCEPTION 'AuditBatch blockNumber is immutable once set (batchId=%).', OLD."batchId";
    END IF;
    IF OLD."anchoredAt" IS NOT NULL AND NEW."anchoredAt" IS DISTINCT FROM OLD."anchoredAt" THEN
      RAISE EXCEPTION 'AuditBatch anchoredAt is immutable once set (batchId=%).', OLD."batchId";
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_audit_batch_immutable" ON "AuditBatch";
CREATE TRIGGER "trg_audit_batch_immutable"
  BEFORE UPDATE OR DELETE ON "AuditBatch"
  FOR EACH ROW EXECUTE FUNCTION "audit_batch_immutable"();

CREATE OR REPLACE FUNCTION "audit_batch_no_anchored_overlap"()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."status" = 'ANCHORED' AND NEW."fromSeq" IS NOT NULL AND NEW."toSeq" IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM "AuditBatch" existing
      WHERE existing."id" <> NEW."id"
        AND existing."status" = 'ANCHORED'
        AND existing."fromSeq" IS NOT NULL
        AND existing."toSeq" IS NOT NULL
        AND int4range(existing."fromSeq", existing."toSeq", '[]') && int4range(NEW."fromSeq", NEW."toSeq", '[]')
    ) THEN
      RAISE EXCEPTION 'AuditBatch anchored sequence range overlaps an existing anchored batch (batchId=%).', NEW."batchId";
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_audit_batch_no_anchored_overlap" ON "AuditBatch";
CREATE TRIGGER "trg_audit_batch_no_anchored_overlap"
  BEFORE INSERT OR UPDATE ON "AuditBatch"
  FOR EACH ROW EXECUTE FUNCTION "audit_batch_no_anchored_overlap"();

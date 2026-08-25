import { PrismaService } from '../../prisma/prisma.service';

/**
 * Ensures the PostgreSQL append-only trigger is active on the BlockchainLogger table.
 * Content columns are strictly immutable once created.
 */
export async function ensureBlockchainLoggerAppendOnlyTrigger(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION "blockchain_logger_append_only"()
    RETURNS TRIGGER AS $$
    BEGIN
      IF current_setting('app.audit_recovery_authorized', true) = 'true' THEN
        IF (TG_OP = 'DELETE') THEN RETURN OLD; END IF;
        RETURN NEW;
      END IF;
      IF (TG_OP = 'DELETE') THEN
        RAISE EXCEPTION 'BlockchainLogger is append-only: DELETE is forbidden (seq=%).', OLD."seq";
      END IF;
      IF (TG_OP = 'UPDATE') THEN
        IF NEW."id"         IS DISTINCT FROM OLD."id"         OR
           NEW."eventId"    IS DISTINCT FROM OLD."eventId"    OR
           NEW."actorId"    IS DISTINCT FROM OLD."actorId"    OR
           NEW."action"     IS DISTINCT FROM OLD."action"     OR
           NEW."entity"     IS DISTINCT FROM OLD."entity"     OR
           NEW."entityId"   IS DISTINCT FROM OLD."entityId"   OR
           NEW."metadata"   IS DISTINCT FROM OLD."metadata"   OR
           NEW."dataHash"   IS DISTINCT FROM OLD."dataHash"   OR
           NEW."dataSalt"   IS DISTINCT FROM OLD."dataSalt"   OR
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
           NEW."visitId"             IS DISTINCT FROM OLD."visitId"             OR
           NEW."medicalOrderId"      IS DISTINCT FROM OLD."medicalOrderId"      OR
           NEW."medicalResultId"     IS DISTINCT FROM OLD."medicalResultId"     OR
           NEW."aiQualityId"        IS DISTINCT FROM OLD."aiQualityId"        OR
           NEW."seq"                IS DISTINCT FROM OLD."seq"                OR
           NEW."prevHash"           IS DISTINCT FROM OLD."prevHash"           OR
           NEW."entryHash"          IS DISTINCT FROM OLD."entryHash"          OR
           NEW."createdAt"          IS DISTINCT FROM OLD."createdAt"
        THEN
          RAISE EXCEPTION 'BlockchainLogger is append-only: content columns are immutable (seq=%).', OLD."seq";
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
  `);

  await prisma.$executeRawUnsafe(
    `DROP TRIGGER IF EXISTS "trg_blockchain_logger_append_only" ON "BlockchainLogger";`,
  );
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER "trg_blockchain_logger_append_only"
      BEFORE UPDATE OR DELETE ON "BlockchainLogger"
      FOR EACH ROW EXECUTE FUNCTION "blockchain_logger_append_only"();
  `);
}

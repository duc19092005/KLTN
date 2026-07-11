-- Relational integrity for audit/outbox/recovery and actor provenance.
-- NOT VALID keeps this deploy safe with historical rows. PostgreSQL still checks all
-- new writes; validate the constraints separately after legacy data is remediated.

CREATE INDEX IF NOT EXISTS "PatientAccess_verifiedById_idx" ON "PatientAccess"("verifiedById");
CREATE INDEX IF NOT EXISTS "Appointment_createdByUserId_idx" ON "Appointment"("createdByUserId");
CREATE INDEX IF NOT EXISTS "AiModelRegistry_createdBy_idx" ON "AiModelRegistry"("createdBy");

ALTER TABLE "User"
  ADD CONSTRAINT "User_deletedBy_fkey"
  FOREIGN KEY ("deletedBy") REFERENCES "User"("id") ON DELETE SET NULL NOT VALID;

ALTER TABLE "Department"
  ADD CONSTRAINT "Department_deletedBy_fkey"
  FOREIGN KEY ("deletedBy") REFERENCES "User"("id") ON DELETE SET NULL NOT VALID;

ALTER TABLE "PatientAccess"
  ADD CONSTRAINT "PatientAccess_verifiedById_fkey"
  FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL NOT VALID;

ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL NOT VALID;

ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL NOT VALID;

ALTER TABLE "AiModelRegistry"
  ADD CONSTRAINT "AiModelRegistry_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT NOT VALID;

ALTER TABLE "AiModelRegistry"
  ADD CONSTRAINT "AiModelRegistry_deletedBy_fkey"
  FOREIGN KEY ("deletedBy") REFERENCES "User"("id") ON DELETE SET NULL NOT VALID;

-- BlockchainLogger is append-only. Actor deletion must be rejected rather than
-- nulling actorId, because nulling would mutate the signed audit payload.
ALTER TABLE "BlockchainLogger"
  ADD CONSTRAINT "BlockchainLogger_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT NOT VALID;

ALTER TABLE "BlockchainLogger"
  ADD CONSTRAINT "BlockchainLogger_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "AuditBatch"("batchId") ON DELETE RESTRICT NOT VALID;

-- Recovery deletes and recreates the same audit IDs within one transaction. These
-- deferred constraints verify the final transaction state without breaking recovery.
ALTER TABLE "AuditOutbox"
  ADD CONSTRAINT "AuditOutbox_auditLogId_fkey"
  FOREIGN KEY ("auditLogId") REFERENCES "BlockchainLogger"("id")
  ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED NOT VALID;

ALTER TABLE "AuditKafkaReceipt"
  ADD CONSTRAINT "AuditKafkaReceipt_auditLogId_fkey"
  FOREIGN KEY ("auditLogId") REFERENCES "BlockchainLogger"("id")
  ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED NOT VALID;

ALTER TABLE "AuditRecovery"
  ADD CONSTRAINT "AuditRecovery_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "AuditBatch"("batchId") ON DELETE RESTRICT NOT VALID;

ALTER TABLE "AuditRecovery"
  ADD CONSTRAINT "AuditRecovery_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT NOT VALID;

ALTER TABLE "AuditRecoveryStageRow"
  ADD CONSTRAINT "AuditRecoveryStageRow_recoveryId_fkey"
  FOREIGN KEY ("recoveryId") REFERENCES "AuditRecovery"("id") ON DELETE CASCADE NOT VALID;

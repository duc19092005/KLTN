-- Kafka delivery metadata is no longer part of the audit anchoring path.
-- BlockchainLogger and AuditBatch remain the durable PostgreSQL source of truth.
DROP TABLE IF EXISTS "AuditKafkaReceipt";
DROP TABLE IF EXISTS "AuditOutbox";

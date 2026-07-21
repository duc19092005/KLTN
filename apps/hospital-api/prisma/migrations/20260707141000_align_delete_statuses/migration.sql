-- Align soft-delete lifecycle for staff/doctor users and AI models.
-- INACTIVE = hidden/disabled but still visible in admin lists.
-- DELETE = soft-deleted and excluded from normal lists.
ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'DELETE';

ALTER TABLE "AiModelRegistry"
  ADD COLUMN IF NOT EXISTS "status" "OperationalStatus" NOT NULL DEFAULT 'ACTIVE';

UPDATE "AiModelRegistry"
SET "status" = CASE WHEN "isDeleted" = true THEN 'DELETE'::"OperationalStatus" ELSE 'ACTIVE'::"OperationalStatus" END
WHERE "status" IS NULL OR "isDeleted" = true;

CREATE INDEX IF NOT EXISTS "AiModelRegistry_status_idx" ON "AiModelRegistry"("status");

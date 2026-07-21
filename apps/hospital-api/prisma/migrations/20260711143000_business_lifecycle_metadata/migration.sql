ALTER TABLE "User"
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "deletedBy" TEXT,
  ADD COLUMN "restoredAt" TIMESTAMP(3);

ALTER TABLE "Department"
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "deletedBy" TEXT,
  ADD COLUMN "restoredAt" TIMESTAMP(3);

ALTER TABLE "AiModelRegistry"
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "deletedBy" TEXT,
  ADD COLUMN "restoredAt" TIMESTAMP(3);

CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");
CREATE INDEX "Department_deletedAt_idx" ON "Department"("deletedAt");
CREATE INDEX "AiModelRegistry_deletedAt_idx" ON "AiModelRegistry"("deletedAt");

UPDATE "User" SET "deletedAt" = "updatedAt" WHERE "status" = 'DELETE' AND "deletedAt" IS NULL;
UPDATE "Department" SET "deletedAt" = "updatedAt" WHERE "status" = 'DELETE' AND "deletedAt" IS NULL;
UPDATE "AiModelRegistry" SET "deletedAt" = "updatedAt" WHERE ("status" = 'DELETE' OR "isDeleted" = TRUE) AND "deletedAt" IS NULL;

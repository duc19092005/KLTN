ALTER TABLE "AiModelRegistry"
  ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "AiModelRegistry_isDeleted_idx" ON "AiModelRegistry"("isDeleted");

-- Add department operational metadata.
ALTER TABLE "Department"
  ADD COLUMN "departmentCode" TEXT,
  ADD COLUMN "floor" TEXT,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';

WITH numbered_departments AS (
  SELECT
    id,
    'PB-' || LPAD(ROW_NUMBER() OVER (ORDER BY "createdAt", id)::TEXT, 4, '0') AS generated_code
  FROM "Department"
)
UPDATE "Department" d
SET "departmentCode" = n.generated_code
FROM numbered_departments n
WHERE d.id = n.id;

ALTER TABLE "Department"
  ALTER COLUMN "departmentCode" SET NOT NULL;

CREATE UNIQUE INDEX "Department_departmentCode_key" ON "Department"("departmentCode");
CREATE INDEX "Department_status_idx" ON "Department"("status");

-- Retire TECHNICIAN. Existing technician users become LAB_MANAGER.
UPDATE "User"
SET "role" = 'LAB_MANAGER'
WHERE "role"::TEXT = 'TECHNICIAN';

ALTER TYPE "UserRole" RENAME TO "UserRole_old";
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'RECEPTIONIST', 'DOCTOR', 'LAB_MANAGER', 'PATIENT');
ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "UserRole"
  USING "role"::TEXT::"UserRole";
DROP TYPE "UserRole_old";

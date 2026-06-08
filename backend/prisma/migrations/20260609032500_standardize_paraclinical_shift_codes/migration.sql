-- Standardize paraclinical shifts to fixed real-world Ca A / Ca B slots.
CREATE TYPE "ShiftCode" AS ENUM ('A', 'B');

ALTER TABLE "ParaclinicalShift"
ADD COLUMN "workDate" TIMESTAMP(3),
ADD COLUMN "shiftCode" "ShiftCode";

UPDATE "ParaclinicalShift"
SET
  "workDate" = date_trunc('day', "startTime"),
  "shiftCode" = CASE
    WHEN EXTRACT(HOUR FROM "startTime") < 12 THEN 'A'::"ShiftCode"
    ELSE 'B'::"ShiftCode"
  END;

ALTER TABLE "ParaclinicalShift"
ALTER COLUMN "workDate" SET NOT NULL,
ALTER COLUMN "shiftCode" SET NOT NULL;

CREATE UNIQUE INDEX "ParaclinicalShift_staffId_workDate_shiftCode_key"
ON "ParaclinicalShift"("staffId", "workDate", "shiftCode");

CREATE INDEX "ParaclinicalShift_departmentId_workDate_shiftCode_idx"
ON "ParaclinicalShift"("departmentId", "workDate", "shiftCode");

CREATE INDEX "ParaclinicalShift_workDate_shiftCode_status_idx"
ON "ParaclinicalShift"("workDate", "shiftCode", "status");

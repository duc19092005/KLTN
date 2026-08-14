-- Standardize paraclinical shifts to fixed real-world Ca A / Ca B slots.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ShiftCode') THEN
    CREATE TYPE "ShiftCode" AS ENUM ('A', 'B');
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ParaclinicalShift') THEN
    ALTER TABLE "ParaclinicalShift"
    ADD COLUMN IF NOT EXISTS "workDate" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "shiftCode" "ShiftCode";

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

    CREATE UNIQUE INDEX IF NOT EXISTS "ParaclinicalShift_staffId_workDate_shiftCode_key"
    ON "ParaclinicalShift"("staffId", "workDate", "shiftCode");

    CREATE INDEX IF NOT EXISTS "ParaclinicalShift_departmentId_workDate_shiftCode_idx"
    ON "ParaclinicalShift"("departmentId", "workDate", "shiftCode");

    CREATE INDEX IF NOT EXISTS "ParaclinicalShift_workDate_shiftCode_status_idx"
    ON "ParaclinicalShift"("workDate", "shiftCode", "status");
  END IF;
END $$;

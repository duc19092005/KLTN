CREATE TYPE "StaffShiftType" AS ENUM ('RECEPTION', 'PARACLINICAL');

CREATE TABLE "StaffShift" (
  "id" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "shiftType" "StaffShiftType" NOT NULL,
  "workDate" TIMESTAMP(3) NOT NULL,
  "shiftCode" "ShiftCode" NOT NULL,
  "startTime" TIMESTAMP(3) NOT NULL,
  "endTime" TIMESTAMP(3) NOT NULL,
  "status" "ShiftStatus" NOT NULL DEFAULT 'PENDING',
  "note" TEXT,
  "rejectionReason" TEXT,
  "approvedById" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "hash256" TEXT,
  "dataSalt" TEXT,

  CONSTRAINT "StaffShift_pkey" PRIMARY KEY ("id")
);

INSERT INTO "StaffShift" (
  "id", "staffId", "departmentId", "shiftType", "workDate", "shiftCode",
  "startTime", "endTime", "status", "note", "rejectionReason", "approvedById",
  "isActive", "createdAt", "updatedAt", "hash256", "dataSalt"
)
SELECT
  "id", "staffId", "departmentId", 'PARACLINICAL'::"StaffShiftType", "workDate", "shiftCode",
  "startTime", "endTime", "status", "note", "rejectionReason", "approvedById",
  "isActive", "createdAt", "updatedAt", "hash256", "dataSalt"
FROM "ParaclinicalShift"
WHERE to_regclass('public."ParaclinicalShift"') IS NOT NULL;

INSERT INTO "StaffShift" (
  "id", "staffId", "departmentId", "shiftType", "workDate", "shiftCode",
  "startTime", "endTime", "status", "note", "rejectionReason", "approvedById",
  "isActive", "createdAt", "updatedAt", "hash256", "dataSalt"
)
SELECT
  "id", "staffId", "departmentId", 'RECEPTION'::"StaffShiftType", "workDate", "shiftCode",
  "startTime", "endTime", "status", "note", "rejectionReason", "approvedById",
  "isActive", "createdAt", "updatedAt", NULL, NULL
FROM "ReceptionShift"
WHERE to_regclass('public."ReceptionShift"') IS NOT NULL
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "BlockchainLogger" RENAME COLUMN "paraclinicalShiftId" TO "staffShiftId";
ALTER INDEX IF EXISTS "BlockchainLogger_paraclinicalShiftId_idx" RENAME TO "BlockchainLogger_staffShiftId_idx";

ALTER TABLE "BlockchainLogger" DROP CONSTRAINT IF EXISTS "BlockchainLogger_paraclinicalShiftId_fkey";
ALTER TABLE "BlockchainLogger"
ADD CONSTRAINT "BlockchainLogger_staffShiftId_fkey"
FOREIGN KEY ("staffShiftId") REFERENCES "StaffShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "StaffShift_staffId_workDate_shiftCode_key" ON "StaffShift"("staffId", "workDate", "shiftCode");
CREATE INDEX "StaffShift_shiftType_idx" ON "StaffShift"("shiftType");
CREATE INDEX "StaffShift_staffId_idx" ON "StaffShift"("staffId");
CREATE INDEX "StaffShift_departmentId_idx" ON "StaffShift"("departmentId");
CREATE INDEX "StaffShift_departmentId_workDate_shiftCode_idx" ON "StaffShift"("departmentId", "workDate", "shiftCode");
CREATE INDEX "StaffShift_shiftType_departmentId_workDate_shiftCode_idx" ON "StaffShift"("shiftType", "departmentId", "workDate", "shiftCode");
CREATE INDEX "StaffShift_workDate_shiftCode_status_idx" ON "StaffShift"("workDate", "shiftCode", "status");
CREATE INDEX "StaffShift_status_idx" ON "StaffShift"("status");
CREATE INDEX "StaffShift_startTime_endTime_idx" ON "StaffShift"("startTime", "endTime");
CREATE INDEX "StaffShift_isActive_idx" ON "StaffShift"("isActive");

ALTER TABLE "StaffShift"
ADD CONSTRAINT "StaffShift_staffId_fkey"
FOREIGN KEY ("staffId") REFERENCES "StaffProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StaffShift"
ADD CONSTRAINT "StaffShift_departmentId_fkey"
FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StaffShift"
ADD CONSTRAINT "StaffShift_approvedById_fkey"
FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP TABLE IF EXISTS "ReceptionShift";
DROP TABLE IF EXISTS "ParaclinicalShift";

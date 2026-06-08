CREATE TABLE "ReceptionShift" (
  "id" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
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

  CONSTRAINT "ReceptionShift_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReceptionShift_staffId_workDate_shiftCode_key"
ON "ReceptionShift"("staffId", "workDate", "shiftCode");

CREATE INDEX "ReceptionShift_staffId_idx" ON "ReceptionShift"("staffId");
CREATE INDEX "ReceptionShift_departmentId_idx" ON "ReceptionShift"("departmentId");
CREATE INDEX "ReceptionShift_departmentId_workDate_shiftCode_idx" ON "ReceptionShift"("departmentId", "workDate", "shiftCode");
CREATE INDEX "ReceptionShift_workDate_shiftCode_status_idx" ON "ReceptionShift"("workDate", "shiftCode", "status");
CREATE INDEX "ReceptionShift_status_idx" ON "ReceptionShift"("status");
CREATE INDEX "ReceptionShift_startTime_endTime_idx" ON "ReceptionShift"("startTime", "endTime");
CREATE INDEX "ReceptionShift_isActive_idx" ON "ReceptionShift"("isActive");

ALTER TABLE "ReceptionShift"
ADD CONSTRAINT "ReceptionShift_staffId_fkey"
FOREIGN KEY ("staffId") REFERENCES "StaffProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReceptionShift"
ADD CONSTRAINT "ReceptionShift_departmentId_fkey"
FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReceptionShift"
ADD CONSTRAINT "ReceptionShift_approvedById_fkey"
FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add specialty metadata for LAB_MANAGER staff so shift registration can be filtered
-- to the appropriate paraclinical departments.
CREATE TYPE "LabSpecialty" AS ENUM ('LABORATORY', 'IMAGING', 'BOTH');

ALTER TABLE "StaffProfile" ADD COLUMN "labSpecialty" "LabSpecialty";

CREATE INDEX "StaffProfile_labSpecialty_idx" ON "StaffProfile"("labSpecialty");

-- Remove patient-facing publication gates.
-- Patient portal visibility is now governed by authenticated PatientAccess ownership only.

DROP INDEX IF EXISTS "Visit_publishedToPatient_idx";
DROP INDEX IF EXISTS "MedicalResult_visibleToPatient_idx";
DROP INDEX IF EXISTS "MedicalConclusion_publishedToPatient_idx";

ALTER TABLE "Visit"
  DROP COLUMN IF EXISTS "publishedToPatient",
  DROP COLUMN IF EXISTS "publishedAt";

ALTER TABLE "MedicalResult"
  DROP COLUMN IF EXISTS "visibleToPatient",
  DROP COLUMN IF EXISTS "publishedAt";

ALTER TABLE "MedicalConclusion"
  DROP COLUMN IF EXISTS "publishedToPatient",
  DROP COLUMN IF EXISTS "publishedAt";

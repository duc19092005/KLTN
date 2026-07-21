-- Drop legacy online booking reason/symptoms fields.
-- These fields are no longer collected during patient online booking or receptionist appointment check-in.
ALTER TABLE "Visit" DROP COLUMN IF EXISTS "reason";
ALTER TABLE "Visit" DROP COLUMN IF EXISTS "symptoms";
ALTER TABLE "Appointment" DROP COLUMN IF EXISTS "reason";
ALTER TABLE "Appointment" DROP COLUMN IF EXISTS "symptoms";

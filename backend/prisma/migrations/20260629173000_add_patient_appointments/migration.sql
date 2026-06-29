-- Add appointment booking support and mark Visit origin.

CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CANCELLED', 'EXPIRED', 'NO_SHOW');
CREATE TYPE "VisitSource" AS ENUM ('WALK_IN', 'APPOINTMENT');

ALTER TABLE "Visit" ADD COLUMN "source" "VisitSource" NOT NULL DEFAULT 'WALK_IN';

CREATE TABLE "Appointment" (
  "id" TEXT NOT NULL,
  "appointmentCode" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "doctorId" TEXT,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "reason" TEXT,
  "symptoms" TEXT,
  "status" "AppointmentStatus" NOT NULL DEFAULT 'CONFIRMED',
  "qrTokenHash" TEXT NOT NULL,
  "qrExpiresAt" TIMESTAMP(3) NOT NULL,
  "checkedInAt" TIMESTAMP(3),
  "visitId" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancelReason" TEXT,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Appointment_appointmentCode_key" ON "Appointment"("appointmentCode");
CREATE UNIQUE INDEX "Appointment_qrTokenHash_key" ON "Appointment"("qrTokenHash");
CREATE UNIQUE INDEX "Appointment_visitId_key" ON "Appointment"("visitId");
CREATE INDEX "Appointment_patientId_idx" ON "Appointment"("patientId");
CREATE INDEX "Appointment_departmentId_idx" ON "Appointment"("departmentId");
CREATE INDEX "Appointment_doctorId_idx" ON "Appointment"("doctorId");
CREATE INDEX "Appointment_scheduledAt_idx" ON "Appointment"("scheduledAt");
CREATE INDEX "Appointment_status_idx" ON "Appointment"("status");
CREATE INDEX "Visit_source_idx" ON "Visit"("source");

ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

/**
 * Canonical Appointment fields used by audit comparison and recovery.
 * Mirrors the CREATE audit snapshot written by patient-portal.service.ts
 * (KLTN_APPOINTMENT_CREATE_AUDIT_V1). qrTokenHash is intentionally excluded —
 * a fresh QR is generated on recovery so it never desyncs from the blockchain.
 */
export function buildAppointmentSnapshot(appointment: any) {
  return {
    appointmentCode: appointment.appointmentCode,
    patientId: appointment.patientId,
    departmentId: appointment.departmentId,
    doctorId: appointment.doctorId ?? null,
    scheduledAt: toIsoString(appointment.scheduledAt ?? null),
    status: appointment.status,
    doctorStaffId: appointment.doctor?.staffProfileId ?? appointment.doctorStaffId ?? null,
  };
}

function toIsoString(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

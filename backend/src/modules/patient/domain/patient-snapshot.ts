/**
 * Business fields included in the Patient integrity hash. Used to detect
 * unauthorized modifications to patient demographic data in the database.
 */
export function buildPatientSnapshot(patient: any) {
  return {
    patientCode: patient.patientCode,
    fullName: patient.fullName,
    gender: patient.gender,
    birthDate: patient.birthDate instanceof Date ? patient.birthDate.toISOString() : patient.birthDate,
    citizenId: patient.citizenId ?? null,
    phone: patient.phone ?? null,
    address: patient.address ?? null,
    insuranceNumber: patient.insuranceNumber ?? null,
    emergencyContact: patient.emergencyContact ?? null,
  };
}

/**
 * Unified snapshot: combines staff identity fields and doctor professional
 * fields into a single object for hashing, so one hash covers the entire doctor
 * record. Extracted verbatim from the former DoctorService.buildUnifiedSnapshot().
 */
export function buildUnifiedDoctorSnapshot(doctor: any) {
  const staff = doctor.staffProfile || {};
  return {
    // Staff identity fields
    employeeCode: staff.employeeCode ?? null,
    fullName: staff.fullName ?? null,
    phone: staff.phone ?? null,
    gender: staff.gender ?? null,
    citizenId: staff.citizenId ?? null,
    birthDate: staff.birthDate instanceof Date ? staff.birthDate.toISOString() : (staff.birthDate ?? null),
    address: staff.address ?? null,
    avatarUrl: staff.avatarUrl ?? null,
    departmentId: staff.departmentId ?? null,
    position: staff.position ?? null,
    // Doctor professional fields
    staffProfileId: doctor.staffProfileId,
    specialty: doctor.specialty,
    licenseNumber: doctor.licenseNumber,
    qualification: doctor.qualification,
    yearsExperience: doctor.yearsExperience ?? null,
  };
}

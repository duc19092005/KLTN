/**
 * Business fields included in the StaffProfile integrity hash. Extracted
 * verbatim from the former StaffService.buildSnapshot().
 */
export function buildStaffSnapshot(staff: any) {
  return {
    employeeCode: staff.employeeCode,
    fullName: staff.fullName,
    phone: staff.phone,
    gender: staff.gender,
    citizenId: staff.citizenId,
    birthDate: staff.birthDate instanceof Date ? staff.birthDate.toISOString() : staff.birthDate,
    address: staff.address ?? null,
    avatarUrl: staff.avatarUrl,
    departmentId: staff.departmentId ?? null,
    position: staff.position ?? null,
    status: staff.user?.status ?? null,
  };
}

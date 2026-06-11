/**
 * Business fields included in the Department integrity hash (excludes timestamps
 * + hash/salt). Extracted verbatim from the former DepartmentService.buildSnapshot().
 */
export function buildDepartmentSnapshot(d: any) {
  return {
    departmentCode: d.departmentCode,
    name: d.name,
    floor: d.floor ?? null,
    status: d.status,
    type: d.type,
    canReceiveOrders: d.canReceiveOrders,
    description: d.description ?? null,
    managerId: d.managerId ?? null,
    specialty: d.specialty ?? null,
  };
}

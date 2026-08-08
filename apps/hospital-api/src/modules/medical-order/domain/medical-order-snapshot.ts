/**
 * Canonical MedicalOrder fields used by audit comparison and recovery.
 * Mirrors the CREATE audit snapshot written by create-medical-order.use-case.ts
 * (schema KLTN_MEDICAL_ORDER_CREATE_AUDIT_V2). Every DB-owned business field is
 * included so the audit log is the source of truth for recovery.
 */
export function buildMedicalOrderSnapshot(order: any) {
  return {
    orderId: order.id,
    orderCode: order.orderCode,
    visitId: order.visitId,
    patientId: order.patientId,
    doctorId: order.doctorId,
    targetDepartmentId: order.targetDepartmentId ?? null,
    orderType: order.orderType,
    priority: order.priority,
    status: order.status,
    clinicalNote: order.clinicalNote ?? null,
  };
}

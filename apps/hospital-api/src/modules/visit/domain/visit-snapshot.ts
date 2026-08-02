/**
 * Canonical non-sensitive Visit fields used by audit comparison and recovery.
 * Patient clinical/demographic data is intentionally excluded; only relation IDs
 * and Visit-owned operational fields are stored in this snapshot.
 */
export function buildVisitSnapshot(visit: any) {
  return {
    visitCode: visit.visitCode,
    patientId: visit.patientId,
    departmentId: visit.departmentId,
    staffId: visit.staffId ?? null,
    status: visit.status,
    source: visit.source,
    checkInAt: visit.checkInAt instanceof Date ? visit.checkInAt.toISOString() : visit.checkInAt,
    completedAt: visit.completedAt instanceof Date ? visit.completedAt.toISOString() : (visit.completedAt ?? null),
  };
}
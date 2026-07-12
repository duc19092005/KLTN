/** Full server-side recovery snapshot. Sensitive text is encrypted by AuditLogger. */
export function buildAiDiagnosisSnapshot(diagnosis: any) {
  if (!diagnosis) return null;
  return {
    aiModelId: diagnosis.aiModelId,
    patientId: diagnosis.patientId ?? null,
    visitId: diagnosis.visitId ?? null,
    prompt: diagnosis.prompt ?? null,
    result: diagnosis.result ?? null,
    confidence: diagnosis.confidence ?? null,
    status: diagnosis.status,
    reviewedByDoctorId: diagnosis.reviewedByDoctorId ?? null,
    doctorFeedback: diagnosis.doctorFeedback ?? null,
  };
}

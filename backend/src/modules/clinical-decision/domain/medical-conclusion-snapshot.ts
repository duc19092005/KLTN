/**
 * Unified snapshot: selects only clinical and structural fields of the MedicalConclusion
 * for integrity hashing. This excludes PII and metadata like database IDs, timestamps, etc.
 */
export function buildMedicalConclusionSnapshot(conclusion: any) {
  if (!conclusion) return null;
  return {
    visitId: conclusion.visitId,
    doctorId: conclusion.doctorId,
    aiDiagnosisId: conclusion.aiDiagnosisId ?? null,
    finalDiagnosis: conclusion.finalDiagnosis ? conclusion.finalDiagnosis.trim() : '',
    treatmentPlan: conclusion.treatmentPlan ? conclusion.treatmentPlan.trim() : null,
    prescription: conclusion.prescription ? conclusion.prescription.trim() : null,
    followUpNote: conclusion.followUpNote ? conclusion.followUpNote.trim() : null,
    doctorNote: conclusion.doctorNote ? conclusion.doctorNote.trim() : null,
  };
}

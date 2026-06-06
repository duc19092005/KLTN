/**
 * Unified snapshot: selects only clinical and structural fields of the MedicalConclusion
 * for integrity hashing. Includes patientCode (via visit→patient) to bind the conclusion
 * to a specific patient identity — preventing patient-swap attacks where a hacker changes
 * the patientId on the Visit record.
 */
export function buildMedicalConclusionSnapshot(conclusion: any) {
  if (!conclusion) return null;
  return {
    visitId: conclusion.visitId,
    patientCode: conclusion.visit?.patient?.patientCode ?? null,
    doctorId: conclusion.doctorId,
    aiDiagnosisId: conclusion.aiDiagnosisId ?? null,
    finalDiagnosis: conclusion.finalDiagnosis ? conclusion.finalDiagnosis.trim() : '',
    treatmentPlan: conclusion.treatmentPlan ? conclusion.treatmentPlan.trim() : null,
    prescription: conclusion.prescription ? conclusion.prescription.trim() : null,
    followUpNote: conclusion.followUpNote ? conclusion.followUpNote.trim() : null,
    doctorNote: conclusion.doctorNote ? conclusion.doctorNote.trim() : null,
  };
}

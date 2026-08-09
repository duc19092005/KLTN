/**
 * Canonical AiQuality fields used by audit comparison and recovery.
 * Mirrors the audit snapshot written by rate-ai-model.use-case.ts
 * (action AI_MODEL_RATED). aiDiagnosisId is included since V2.
 */
export function buildAiQualitySnapshot(quality: any) {
  return {
    doctorId: quality.doctorId,
    aiModelId: quality.aiModelId,
    aiDiagnosisId: quality.aiDiagnosisId ?? null,
    doctorConclusionAboutModel: quality.doctorConclusionAboutModel,
    trustablePercent: quality.trustablePercent,
  };
}

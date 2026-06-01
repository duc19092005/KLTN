/**
 * Business fields included in the AI model integrity hash. Extracted verbatim
 * from the former AiModelService.buildSnapshot() so the on-chain anchor and the
 * integrity evaluation hash exactly the same projection.
 */
export function buildAiModelSnapshot(m: any) {
  return {
    modelName: m.modelName,
    modelVersion: m.modelVersion,
    recommendedSpecialty: m.recommendedSpecialty ?? null,
    type: m.type ?? null,
    provider: m.provider ?? null,
    apiEndpoint: m.apiEndpoint ?? null,
    ipHashPlain: m.ipHashPlain ?? null,
    description: m.description ?? null,
    createdBy: m.createdBy,
  };
}

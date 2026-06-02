/** DI token for the AI provider connectivity tester port. */
export const AI_MODEL_CONNECTIVITY = Symbol('AI_MODEL_CONNECTIVITY');

export type AiConnectivityTestInput = {
  provider: string;
  modelVersion: string;
  secretOrIpHash?: string;
  apiEndpoint?: string;
};

export type AiConnectivityTestResult = {
  ok: boolean;
  provider: string;
  endpoint: string;
  latencyMs: number;
  message: string;
};

/**
 * Boundary for testing live connectivity to an AI provider endpoint. The
 * adapter owns endpoint resolution and the provider-specific ping payloads.
 */
export interface AiModelConnectivityPort {
  test(input: AiConnectivityTestInput): Promise<AiConnectivityTestResult>;
  /** Resolves the effective endpoint (preset by provider or custom). */
  resolveApiEndpoint(provider: string, customEndpoint?: string, modelVersion?: string): string;
}

import { AiModelRegistry } from '@prisma/client';
import { AiImageAttachment, AiProviderResponse } from '../../application/ports/ai-provider-gateway.port';

export type ClinicalAiProvider = 'gemini' | 'anthropic' | 'openai-compatible';

/** Provider-specific client behind the composite clinical AI gateway. */
export interface ClinicalAiProviderClient {
  readonly provider: ClinicalAiProvider;
  generate(
    model: AiModelRegistry,
    apiKey: string,
    prompt: string,
    images: AiImageAttachment[],
  ): Promise<AiProviderResponse>;
}
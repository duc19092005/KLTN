import { Injectable } from '@nestjs/common';
import { AiModelRegistry } from '@prisma/client';
import {
  AiImageAttachment,
  AiProviderGatewayPort,
  AiProviderResponse,
} from '../../application/ports/ai-provider-gateway.port';
import { ClinicalAiCredentialResolver } from './clinical-ai-credential.resolver';
import { AnthropicClinicalAiClient } from './anthropic-clinical-ai.client';
import { ClinicalAiProvider, ClinicalAiProviderClient } from './clinical-ai-provider-client';
import { GeminiClinicalAiClient } from './gemini-clinical-ai.client';
import { OpenAiCompatibleClinicalAiClient } from './openai-compatible-clinical-ai.client';

/** Composite outbound adapter that selects an isolated client per provider protocol. */
@Injectable()
export class ProviderClinicalAiGateway implements AiProviderGatewayPort {
  private readonly clients: Map<ClinicalAiProvider, ClinicalAiProviderClient>;

  constructor(
    credentials: ClinicalAiCredentialResolver,
    gemini: GeminiClinicalAiClient,
    anthropic: AnthropicClinicalAiClient,
    openAiCompatible: OpenAiCompatibleClinicalAiClient,
  ) {
    this.credentials = credentials;
    this.clients = new Map<ClinicalAiProvider, ClinicalAiProviderClient>([
      [gemini.provider, gemini],
      [anthropic.provider, anthropic],
      [openAiCompatible.provider, openAiCompatible],
    ]);
  }

  private readonly credentials: ClinicalAiCredentialResolver;

  async generate(
    model: AiModelRegistry,
    prompt: string,
    images: AiImageAttachment[],
  ): Promise<AiProviderResponse> {
    const apiKey = this.credentials.decrypt(model.ipHashEncrypted);
    return this.selectClient(model.provider).generate(model, apiKey, prompt, images);
  }

  private selectClient(provider: string | null): ClinicalAiProviderClient {
    const normalized = (provider || '').toLowerCase();
    const key: ClinicalAiProvider = normalized === 'gemini'
      ? 'gemini'
      : normalized === 'anthropic'
        ? 'anthropic'
        : 'openai-compatible';
    return this.clients.get(key)!;
  }
}
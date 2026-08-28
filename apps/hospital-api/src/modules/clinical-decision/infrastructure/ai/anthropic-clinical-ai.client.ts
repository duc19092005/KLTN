import { Injectable } from '@nestjs/common';
import { AiModelRegistry } from '@prisma/client';
import { AiImageAttachment, AiProviderResponse } from '../../application/ports/ai-provider-gateway.port';
import { CLINICAL_AI_SYSTEM_PROMPT } from '../../domain/clinical-ai.constants';
import { ClinicalAiHttpClient } from './clinical-ai-http.client';
import { ClinicalAiProviderClient } from './clinical-ai-provider-client';
import { ClinicalAiResponseParser } from './clinical-ai-response.parser';

@Injectable()
export class AnthropicClinicalAiClient implements ClinicalAiProviderClient {
  readonly provider = 'anthropic' as const;

  constructor(
    private readonly http: ClinicalAiHttpClient,
    private readonly parser: ClinicalAiResponseParser,
  ) {}

  async generate(
    model: AiModelRegistry,
    apiKey: string,
    prompt: string,
    images: AiImageAttachment[],
  ): Promise<AiProviderResponse> {
    const content: Array<Record<string, unknown>> = [{ type: 'text', text: prompt }];
    for (const image of images) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: image.mimeType, data: image.base64 },
      });
    }
    const response = await this.http.postJson(model.apiEndpoint!, {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    }, {
      model: model.modelVersion,
      max_tokens: 1200,
      temperature: 0.2,
      system: CLINICAL_AI_SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    });
    return this.parser.normalize(this.extractText(response));
  }

  private extractText(response: unknown): string {
    const content = this.isRecord(response) && Array.isArray(response.content) ? response.content : [];
    const text = content
      .map((item) => (this.isRecord(item) && typeof item.text === 'string' ? item.text : undefined))
      .filter((item): item is string => Boolean(item))
      .join('\n');
    return text || JSON.stringify(response);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }
}
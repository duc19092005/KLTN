import { Injectable } from '@nestjs/common';
import { AiModelRegistry } from '@prisma/client';
import { AiImageAttachment, AiProviderResponse } from '../../application/ports/ai-provider-gateway.port';
import { CLINICAL_AI_SYSTEM_PROMPT } from '../../domain/clinical-ai.constants';
import { ClinicalAiHttpClient } from './clinical-ai-http.client';
import { ClinicalAiProviderClient } from './clinical-ai-provider-client';
import { ClinicalAiResponseParser } from './clinical-ai-response.parser';

@Injectable()
export class OpenAiCompatibleClinicalAiClient implements ClinicalAiProviderClient {
  readonly provider = 'openai-compatible' as const;

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
    const userContent = images.length
      ? [
          { type: 'text', text: prompt },
          ...images.map((image) => ({
            type: 'image_url',
            image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
          })),
        ]
      : prompt;
    const response = await this.http.postJson(model.apiEndpoint!, { Authorization: `Bearer ${apiKey}` }, {
      model: model.modelVersion,
      temperature: 0.2,
      messages: [
        { role: 'system', content: CLINICAL_AI_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
    });
    return this.parser.normalize(this.extractText(response));
  }

  private extractText(response: unknown): string {
    if (!this.isRecord(response)) return JSON.stringify(response);
    const choices = Array.isArray(response.choices) ? response.choices : [];
    const firstChoice = choices[0];
    const message = this.isRecord(firstChoice) && this.isRecord(firstChoice.message)
      ? firstChoice.message.content
      : undefined;
    const text = message ?? (this.isRecord(firstChoice) ? firstChoice.text : undefined)
      ?? response.output_text
      ?? response.text;
    return typeof text === 'string' ? text : JSON.stringify(response);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }
}
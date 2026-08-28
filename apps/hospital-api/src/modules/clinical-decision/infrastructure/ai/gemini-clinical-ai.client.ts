import { BadRequestException, Injectable } from '@nestjs/common';
import { AiModelRegistry } from '@prisma/client';
import { AiImageAttachment, AiProviderResponse } from '../../application/ports/ai-provider-gateway.port';
import { CLINICAL_AI_SYSTEM_PROMPT } from '../../domain/clinical-ai.constants';
import { ClinicalAiHttpClient } from './clinical-ai-http.client';
import { ClinicalAiProviderClient } from './clinical-ai-provider-client';
import { ClinicalAiResponseParser } from './clinical-ai-response.parser';

@Injectable()
export class GeminiClinicalAiClient implements ClinicalAiProviderClient {
  readonly provider = 'gemini' as const;

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
    const endpoint = this.withApiKey(this.withModel(model.apiEndpoint!, model.modelVersion), apiKey);
    const parts: Array<Record<string, unknown>> = [{ text: `${CLINICAL_AI_SYSTEM_PROMPT}\n\n${prompt}` }];
    for (const image of images) {
      parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } });
    }
    const response = await this.http.postJson(endpoint, {}, {
      contents: [{ role: 'user', parts }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    });
    return this.parser.normalize(this.extractText(response));
  }

  private withApiKey(endpoint: string, apiKey: string): string {
    try {
      const url = new URL(endpoint);
      if (!url.searchParams.has('key')) url.searchParams.set('key', apiKey);
      return url.toString();
    } catch {
      throw new BadRequestException('Gemini API endpoint đã chọn không hợp lệ.');
    }
  }

  private withModel(endpoint: string, modelVersion: string): string {
    return endpoint.includes(':generateContent')
      ? endpoint.replace(/models\/[^/:]+:generateContent/, `models/${modelVersion}:generateContent`)
      : endpoint;
  }

  private extractText(response: unknown): string {
    const candidates = this.isRecord(response) && Array.isArray(response.candidates) ? response.candidates : [];
    const content = this.isRecord(candidates[0]) && this.isRecord(candidates[0].content)
      ? candidates[0].content
      : undefined;
    const parts = content && Array.isArray(content.parts) ? content.parts : [];
    const text = parts
      .map((part) => (this.isRecord(part) && typeof part.text === 'string' ? part.text : undefined))
      .filter((part): part is string => Boolean(part))
      .join('\n');
    return text || JSON.stringify(response);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }
}
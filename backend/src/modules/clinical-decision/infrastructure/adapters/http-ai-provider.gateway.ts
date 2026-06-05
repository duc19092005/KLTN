import { BadRequestException, Injectable } from '@nestjs/common';
import { createDecipheriv } from 'crypto';
import { AiModelRegistry } from '@prisma/client';
import { CLINICAL_AI_DISCLAIMER, CLINICAL_AI_SYSTEM_PROMPT } from '../../domain/clinical-ai.constants';
import {
  AiImageAttachment,
  AiProviderGatewayPort,
  AiProviderResponse,
} from '../../application/ports/ai-provider-gateway.port';

/**
 * Outbound adapter that calls a registered AI model. Logic copied verbatim from
 * the former ClinicalDecisionService: AES-256-GCM secret decryption, multimodal
 * payload shaping per provider, HTTP with timeout, and response normalization.
 */
@Injectable()
export class HttpAiProviderGateway implements AiProviderGatewayPort {
  async generate(aiModel: AiModelRegistry, prompt: string, images: AiImageAttachment[]): Promise<AiProviderResponse> {
    const token = this.decryptSecret(aiModel.ipHashEncrypted);
    const provider = (aiModel.provider || 'other').toLowerCase();

    if (provider === 'gemini') return this.callGemini(aiModel, token, prompt, images);
    if (provider === 'anthropic') return this.callAnthropic(aiModel, token, prompt, images);
    return this.callOpenAiCompatible(aiModel, token, prompt, images);
  }

  private async callOpenAiCompatible(aiModel: AiModelRegistry, token: string, prompt: string, images: AiImageAttachment[]): Promise<AiProviderResponse> {
    // OpenAI-compatible vision: user content becomes an array of text + image_url(data URL) parts.
    const userContent = images.length
      ? [
        { type: 'text', text: prompt },
        ...images.map((img) => ({ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.base64}` } })),
      ]
      : prompt;

    const response = await this.postJson(aiModel.apiEndpoint!, {
      Authorization: `Bearer ${token}`,
    }, {
      model: aiModel.modelVersion,
      temperature: 0.2,
      messages: [
        { role: 'system', content: CLINICAL_AI_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
    });

    const text = this.extractOpenAiCompatibleText(response);
    return this.normalizeProviderResponse(text);
  }

  private async callGemini(aiModel: AiModelRegistry, token: string, prompt: string, images: AiImageAttachment[]): Promise<AiProviderResponse> {
    const endpoint = this.withGeminiApiKey(this.withGeminiModel(aiModel.apiEndpoint!, aiModel.modelVersion), token);
    // Gemini vision: append each image as an inlineData part alongside the text part.
    const parts: any[] = [{ text: `${CLINICAL_AI_SYSTEM_PROMPT}\n\n${prompt}` }];
    for (const img of images) parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });

    const response = await this.postJson(endpoint, {}, {
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    });

    const text = response?.candidates?.[0]?.content?.parts?.map((part: any) => part.text).filter(Boolean).join('\n');
    return this.normalizeProviderResponse(text || JSON.stringify(response));
  }

  private async callAnthropic(aiModel: AiModelRegistry, token: string, prompt: string, images: AiImageAttachment[]): Promise<AiProviderResponse> {
    // Claude vision: content is an array of text + base64 image source blocks.
    const content: any[] = [{ type: 'text', text: prompt }];
    for (const img of images) content.push({ type: 'image', source: { type: 'base64', media_type: img.mimeType, data: img.base64 } });

    const response = await this.postJson(aiModel.apiEndpoint!, {
      'x-api-key': token,
      'anthropic-version': '2023-06-01',
    }, {
      model: aiModel.modelVersion,
      max_tokens: 1200,
      temperature: 0.2,
      system: CLINICAL_AI_SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    });

    const text = response?.content?.map((item: any) => item.text).filter(Boolean).join('\n');
    return this.normalizeProviderResponse(text || JSON.stringify(response));
  }

  private async postJson(endpoint: string, headers: Record<string, string>, body: Record<string, any>) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...headers,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const responseText = await response.text();
      const responseJson = this.tryParseJson(responseText);

      if (!response.ok) {
        throw new BadRequestException(`Yêu cầu đến nhà cung cấp AI thất bại (${response.status}): ${this.extractProviderError(responseJson, responseText)}`);
      }

      return responseJson || { text: responseText };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      const message = error instanceof Error ? error.message : 'Unknown AI provider error';
      throw new BadRequestException(`Yêu cầu đến nhà cung cấp AI thất bại: ${this.truncate(message)}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  private decryptSecret(encryptedValue: string) {
    const rawKey = process.env.ENCRYPTION_KEY;
    if (!rawKey) throw new BadRequestException('Chưa cấu hình khóa mã hóa ENCRYPTION_KEY.');

    const key = Buffer.from(rawKey, 'hex');
    if (key.length !== 32) throw new BadRequestException('ENCRYPTION_KEY phải là chuỗi hex 32 bytes cho AES-256.');

    // Expected format: v1:ivHex:tagHex:cipherHex (AES-256-GCM, authenticated).
    if (!encryptedValue.startsWith('v1:')) throw new BadRequestException('Khóa bí mật của mô hình AI không hợp lệ hoặc dùng định dạng cũ. Vui lòng nhập lại API key.');
    const [, ivHex, tagHex, cipherHex] = encryptedValue.split(':');
    if (!ivHex || !tagHex || !cipherHex) throw new BadRequestException('Khóa bí mật của mô hình AI không hợp lệ.');

    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(cipherHex, 'hex')), decipher.final()]).toString('utf8');
  }

  private withGeminiApiKey(endpoint: string, token: string) {
    try {
      const url = new URL(endpoint);
      if (!url.searchParams.has('key')) url.searchParams.set('key', token);
      return url.toString();
    } catch {
      throw new BadRequestException('Gemini API endpoint đã chọn không hợp lệ.');
    }
  }

  private withGeminiModel(endpoint: string, modelVersion: string) {
    return endpoint.includes(':generateContent')
      ? endpoint.replace(/models\/[^/:]+:generateContent/, `models/${modelVersion}:generateContent`)
      : endpoint;
  }

  private extractOpenAiCompatibleText(response: any) {
    return response?.choices?.[0]?.message?.content
      || response?.choices?.[0]?.text
      || response?.output_text
      || response?.text
      || JSON.stringify(response);
  }

  private normalizeProviderResponse(text: string): AiProviderResponse {
    const parsed = this.extractJsonObject(text);
    const confidence = this.extractConfidence(parsed);
    const analysis = parsed ? { ...parsed, disclaimer: CLINICAL_AI_DISCLAIMER } : undefined;
    return { text, parsed: analysis, ...(confidence !== undefined ? { confidence } : {}) };
  }

  private extractJsonObject(text: string) {
    const trimmed = text.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
    const candidates = [trimmed, fenced, trimmed.slice(trimmed.indexOf('{'), trimmed.lastIndexOf('}') + 1)].filter(Boolean);

    for (const candidate of candidates) {
      const parsed = this.tryParseJson(candidate as string);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    }
    return undefined;
  }

  private tryParseJson(value: string) {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }

  private extractConfidence(parsed?: Record<string, any>) {
    const value = Number(parsed?.confidence);
    if (!Number.isFinite(value)) return undefined;
    if (value < 0 || value > 1) return undefined;
    return value;
  }

  private extractProviderError(responseJson: any, responseText: string) {
    const message = responseJson?.error?.message || responseJson?.message || responseText || 'Provider returned an error';
    return this.truncate(String(message));
  }

  private truncate(value: string, maxLength = 800) {
    return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
  }
}

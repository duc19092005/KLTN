import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AiConnectivityTestInput,
  AiConnectivityTestResult,
  AiModelConnectivityPort,
} from '../../application/ports/ai-model-connectivity.port';

/**
 * Tests live connectivity to an AI provider. Logic copied verbatim from the
 * former AiModelService (testApi, resolveApiEndpoint, testOpenAiCompatible,
 * testGemini, readProviderError).
 */
@Injectable()
export class HttpAiModelConnectivityAdapter implements AiModelConnectivityPort {
  async test(input: AiConnectivityTestInput): Promise<AiConnectivityTestResult> {
    const endpoint = this.resolveApiEndpoint(input.provider, input.apiEndpoint, input.modelVersion);
    const provider = input.provider.toLowerCase();
    const startedAt = Date.now();

    try {
      if (provider === 'gemini') await this.testGemini(endpoint, input.secretOrIpHash || '', input.modelVersion);
      else await this.testOpenAiCompatible(endpoint, input.secretOrIpHash || '', input.modelVersion);
      return { ok: true, provider: input.provider, endpoint, latencyMs: Date.now() - startedAt, message: 'Nhà cung cấp API hoạt động.' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi kiểm tra API không xác định';
      throw new BadRequestException(`Kiểm tra kết nối API thất bại: ${message}`);
    }
  }

  resolveApiEndpoint(provider: string, customEndpoint?: string, modelVersion?: string): string {
    if (customEndpoint?.trim()) return customEndpoint.trim();
    const model = modelVersion?.trim() || 'gemini-2.5-flash';
    const map: Record<string, string> = {
      chatgpt: 'https://api.openai.com/v1/chat/completions',
      deepseek: 'https://api.deepseek.com/chat/completions',
      qwen: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
      anthropic: 'https://api.anthropic.com/v1/messages',
      gemini: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    };
    const endpoint = map[provider.toLowerCase()];
    // local (self-hosted Llama/Ollama/vLLM) and other (custom) have no preset URL: the admin
    // must supply the endpoint explicitly.
    if (!endpoint) {
      throw new BadRequestException(
        'Vui lòng nhập API Endpoint cho model tự host / tùy chỉnh (ví dụ http://localhost:11434/v1/chat/completions).',
      );
    }
    return endpoint;
  }

  private async testOpenAiCompatible(endpoint: string, token: string, modelVersion: string) {
    // Token is optional: local OpenAI-compatible servers (Ollama, vLLM) usually accept no auth.
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: modelVersion, messages: [{ role: 'user', content: 'ping' }], max_tokens: 8, temperature: 0 }),
    });
    if (!response.ok) throw new Error(await this.readProviderError(response));
  }

  private async testGemini(endpoint: string, token: string, modelVersion: string) {
    const url = endpoint.includes(':generateContent') ? endpoint.replace(/models\/[^/:]+:generateContent/, `models/${modelVersion}:generateContent`) : endpoint;
    const withKey = new URL(url);
    if (!withKey.searchParams.has('key')) withKey.searchParams.set('key', token);
    const response = await fetch(withKey.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'ping' }] }], generationConfig: { maxOutputTokens: 8, temperature: 0 } }),
    });
    if (!response.ok) throw new Error(await this.readProviderError(response));
  }

  private async readProviderError(response: Response) {
    const text = await response.text();
    try {
      const json = JSON.parse(text);
      return json?.error?.message || json?.message || text;
    } catch {
      return text || `HTTP ${response.status}`;
    }
  }
}

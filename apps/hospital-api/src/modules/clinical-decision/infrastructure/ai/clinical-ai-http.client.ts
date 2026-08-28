import { BadRequestException, Injectable } from '@nestjs/common';

/** Shared HTTP boundary for outbound AI provider calls. */
@Injectable()
export class ClinicalAiHttpClient {
  async postJson(
    endpoint: string,
    headers: Record<string, string>,
    body: unknown,
  ): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const responseText = await response.text();
      const responseJson = this.tryParseJson(responseText);

      if (!response.ok) {
        throw new BadRequestException(
          `Yêu cầu đến nhà cung cấp AI thất bại (${response.status}): ${this.extractError(responseJson, responseText)}`,
        );
      }
      return responseJson ?? { text: responseText };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      const message = error instanceof Error ? error.message : 'Unknown AI provider error';
      throw new BadRequestException(`Yêu cầu đến nhà cung cấp AI thất bại: ${this.truncate(message)}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  private tryParseJson(value: string): unknown | undefined {
    try { return JSON.parse(value) as unknown; } catch { return undefined; }
  }

  private extractError(response: unknown, responseText: string): string {
    if (this.isRecord(response)) {
      const error = this.isRecord(response.error) ? response.error.message : undefined;
      const message = error ?? response.message;
      if (typeof message === 'string') return this.truncate(message);
    }
    return this.truncate(responseText || 'Provider returned an error');
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  private truncate(value: string, maxLength = 800): string {
    return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
  }
}
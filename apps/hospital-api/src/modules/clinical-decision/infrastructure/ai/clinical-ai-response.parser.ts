import { Injectable } from '@nestjs/common';
import { AiProviderResponse } from '../../application/ports/ai-provider-gateway.port';
import { CLINICAL_AI_DISCLAIMER } from '../../domain/clinical-ai.constants';

/** Normalizes provider text into the stable application response contract. */
@Injectable()
export class ClinicalAiResponseParser {
  normalize(text: string): AiProviderResponse {
    const parsed = this.extractJsonObject(text);
    const confidence = this.extractConfidence(parsed);
    const analysis = parsed ? { ...parsed, disclaimer: CLINICAL_AI_DISCLAIMER } : undefined;
    return { text, parsed: analysis, ...(confidence !== undefined ? { confidence } : {}) };
  }

  private extractJsonObject(text: string): Record<string, unknown> | undefined {
    const trimmed = text.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
    const objectStart = trimmed.indexOf('{');
    const objectEnd = trimmed.lastIndexOf('}');
    const candidates = [
      trimmed,
      fenced,
      objectStart >= 0 && objectEnd >= objectStart ? trimmed.slice(objectStart, objectEnd + 1) : undefined,
    ].filter((candidate): candidate is string => Boolean(candidate));

    for (const candidate of candidates) {
      const parsed = this.tryParseObject(candidate);
      if (parsed) return parsed;
    }
    return undefined;
  }

  private tryParseObject(value: string): Record<string, unknown> | undefined {
    try {
      const parsed: unknown = JSON.parse(value);
      return this.isRecord(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }

  private extractConfidence(parsed?: Record<string, unknown>): number | undefined {
    const direct = this.normalizeConfidenceValue(parsed?.confidence);
    if (direct !== undefined) return direct;
    const probabilities = Array.isArray(parsed?.diagnosticProbabilities)
      ? parsed.diagnosticProbabilities
      : [];
    const strongest = probabilities
      .map((item) => this.normalizeConfidenceValue(this.isRecord(item) ? item.probability : undefined))
      .filter((value): value is number => value !== undefined)
      .sort((left, right) => right - left)[0];
    return strongest;
  }

  private normalizeConfidenceValue(raw: unknown): number | undefined {
    if (raw === null || raw === undefined || raw === '') return undefined;
    const value = Number(String(raw).replace('%', '').trim());
    if (!Number.isFinite(value) || value < 0) return undefined;
    if (value <= 1) return value;
    if (value <= 100) return value / 100;
    return undefined;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }
}
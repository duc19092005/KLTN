import { AiModelRegistry } from '@prisma/client';

/** DI token for the AI provider gateway port. */
export const AI_PROVIDER_GATEWAY = Symbol('AI_PROVIDER_GATEWAY');

/**
 * A medical image downloaded from (private) Cloudinary storage and inlined as
 * base64 so it can be sent as real multimodal input to the AI provider instead
 * of an unreachable text URL.
 */
export type AiImageAttachment = { mimeType: string; base64: string; label: string };

export type AiProviderResponse = {
  parsed?: Record<string, any>;
  text: string;
  confidence?: number;
};

/**
 * Outbound boundary for calling a registered AI model (OpenAI-compatible,
 * Gemini, Anthropic). The adapter owns secret decryption, multimodal payload
 * shaping, HTTP, and response normalization.
 */
export interface AiProviderGatewayPort {
  generate(aiModel: AiModelRegistry, prompt: string, images: AiImageAttachment[]): Promise<AiProviderResponse>;
}

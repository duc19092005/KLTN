/** DI token for the AI model secret crypto port. */
export const AI_MODEL_CRYPTO = Symbol('AI_MODEL_CRYPTO');

/**
 * Boundary for the secret-handling crypto used by the AI model registry:
 * AES-256-GCM encryption of the API key/identity material and a SHA-256
 * fingerprint for display/integrity.
 */
export interface AiModelCryptoPort {
  /** AES-256-GCM encrypt, returns v1:ivHex:tagHex:cipherHex. */
  encrypt(value: string): string;
  /** SHA-256 hex fingerprint of the value. */
  fingerprint(value: string): string;
}

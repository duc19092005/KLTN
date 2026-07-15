/** DI token for the secret encryption port. */
export const ENCRYPTION_PORT = Symbol('ENCRYPTION_PORT');

/**
 * Boundary for the secret crypto used by auth (recovery secret + face template
 * encryption). Wraps EncryptionService so the auth use cases depend on an interface
 * instead of the concrete Encryption module.
 */
export interface EncryptionPort {
  generateSecret(): string;
  encryptSecret(secret: string): string;
  decryptSecret(encryptedSecret: string): string;
}

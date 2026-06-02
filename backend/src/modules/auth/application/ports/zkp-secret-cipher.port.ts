/** DI token for the ZKP secret cipher port. */
export const ZKP_SECRET_CIPHER = Symbol('ZKP_SECRET_CIPHER');

/**
 * Boundary for the secret crypto used by auth (recovery secret + face template
 * encryption). Wraps ZkpService so the auth use cases depend on an interface
 * instead of the concrete ZKP module.
 */
export interface ZkpSecretCipherPort {
  generateSecret(): string;
  encryptSecret(secret: string): string;
  decryptSecret(encryptedSecret: string): string;
}

import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as CryptoJS from 'crypto-js';

@Injectable()
export class EncryptionService {
  private readonly encryptionKey: Buffer;

  constructor() {
    this.encryptionKey = this.resolveEncryptionKey();
  }

  generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  encryptSecret(secret: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
  }

  decryptSecret(encryptedSecret: string): string {
    if (!encryptedSecret.startsWith('v1:')) {
      const legacyKey = process.env.ENCRYPTION_KEY || 'default_encryption_key_32bytes!!';
      const bytes = CryptoJS.AES.decrypt(encryptedSecret, legacyKey);
      return bytes.toString(CryptoJS.enc.Utf8);
    }

    const [, ivValue, tagValue, ciphertextValue] = encryptedSecret.split(':');
    if (!ivValue || !tagValue || !ciphertextValue) {
      throw new Error('Invalid encrypted secret format');
    }

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, Buffer.from(ivValue, 'base64'));
    decipher.setAuthTag(Buffer.from(tagValue, 'base64'));

    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  private resolveEncryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY;
    if (process.env.NODE_ENV === 'test' && !key) {
      return crypto.createHash('sha256').update('test_encryption_key_for_local_tests_only').digest();
    }

    if (!key || key === 'default_encryption_key_32bytes!!') {
      throw new Error('ENCRYPTION_KEY must be configured');
    }

    if (/^[a-fA-F0-9]{64}$/.test(key)) {
      return Buffer.from(key, 'hex');
    }

    const base64Key = Buffer.from(key, 'base64');
    if (base64Key.length === 32) {
      return base64Key;
    }

    if (key.length >= 32) {
      return crypto.createHash('sha256').update(key).digest();
    }

    throw new Error('ENCRYPTION_KEY must be a 32-byte base64 value, 64 hex chars, or at least 32 characters');
  }
}

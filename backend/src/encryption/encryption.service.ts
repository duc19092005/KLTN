import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-cbc';
  private readonly key: Buffer;
  private readonly ivLength = 16; // AES block size

  constructor() {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey || encryptionKey.length !== 64) {
      throw new Error(
        'ENCRYPTION_KEY must be 64 hex characters (32 bytes) for AES-256',
      );
    }
    // Convert hex string to Buffer
    this.key = Buffer.from(encryptionKey, 'hex');
  }

  /**
   * Encrypt data using AES-256-CBC
   * @param text Plain text to encrypt
   * @returns Encrypted string in format: iv:encryptedData (both hex encoded)
   */
  encrypt(text: string): string {
    // Generate random IV for each encryption
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Return IV + encrypted data (both in hex)
    return `${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt data using AES-256-CBC
   * @param encryptedText Encrypted string in format: iv:encryptedData
   * @returns Decrypted plain text
   */
  decrypt(encryptedText: string): string {
    try {
      const parts = encryptedText.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encryptedData = parts[1];

      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);

      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Hash data using SHA-256
   * @param data Data to hash
   * @returns Hex encoded hash
   */
  hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate a random secret key (for ZKP or other purposes)
   * @param length Length in bytes (default 32)
   * @returns Hex encoded random string
   */
  generateRandomSecret(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }
}

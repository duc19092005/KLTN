import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as CryptoJS from 'crypto-js';

@Injectable()
export class ZkpService {
  private readonly encryptionKey: string;

  constructor() {
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'default_encryption_key_32bytes!!';
  }

  generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  encryptSecret(secret: string): string {
    return CryptoJS.AES.encrypt(secret, this.encryptionKey).toString();
  }

  decryptSecret(encryptedSecret: string): string {
    const bytes = CryptoJS.AES.decrypt(encryptedSecret, this.encryptionKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  }
}

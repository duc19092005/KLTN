import { BadRequestException, Injectable } from '@nestjs/common';
import { createCipheriv, createHash, randomBytes } from 'crypto';
import { AiModelCryptoPort } from '../../application/ports/ai-model-crypto.port';

/**
 * Crypto adapter for AI model secrets. Logic copied verbatim from the former
 * AiModelService (encryptAes256 + createFingerprint).
 */
@Injectable()
export class AiModelCryptoAdapter implements AiModelCryptoPort {
  encrypt(value: string): string {
    const rawKey = process.env.ENCRYPTION_KEY;
    if (!rawKey) throw new BadRequestException('Chưa cấu hình khóa mã hóa ENCRYPTION_KEY.');

    const key = Buffer.from(rawKey, 'hex');
    if (key.length !== 32) throw new BadRequestException('ENCRYPTION_KEY phải là chuỗi hex 32 bytes cho AES-256.');

    // AES-256-GCM: authenticated encryption. The auth tag lets decryption detect
    // tampering/corruption, which plain CBC cannot. Stored as v1:ivHex:tagHex:cipherHex.
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  fingerprint(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}

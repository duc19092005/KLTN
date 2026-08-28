import { BadRequestException, Injectable } from '@nestjs/common';
import { createDecipheriv } from 'crypto';

/** Resolves encrypted API credentials without leaking crypto details to provider clients. */
@Injectable()
export class ClinicalAiCredentialResolver {
  decrypt(encryptedValue: string): string {
    const rawKey = process.env.ENCRYPTION_KEY;
    if (!rawKey) throw new BadRequestException('Chưa cấu hình khóa mã hóa ENCRYPTION_KEY.');

    const key = Buffer.from(rawKey, 'hex');
    if (key.length !== 32) {
      throw new BadRequestException('ENCRYPTION_KEY phải là chuỗi hex 32 bytes cho AES-256.');
    }
    if (!encryptedValue.startsWith('v1:')) {
      throw new BadRequestException('Khóa bí mật của mô hình AI không hợp lệ hoặc dùng định dạng cũ. Vui lòng nhập lại API key.');
    }

    const [, ivHex, tagHex, cipherHex] = encryptedValue.split(':');
    if (!ivHex || !tagHex || !cipherHex) {
      throw new BadRequestException('Khóa bí mật của mô hình AI không hợp lệ.');
    }

    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([
      decipher.update(Buffer.from(cipherHex, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  }
}
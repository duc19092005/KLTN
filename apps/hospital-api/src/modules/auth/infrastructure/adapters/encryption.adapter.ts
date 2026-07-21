import { Injectable } from '@nestjs/common';
import { EncryptionService } from '../../../encryption/services/encryption.service';
import { EncryptionPort } from '../../application/ports/encryption.port';

/**
 * Adapter binding the secret encryption port to the concrete EncryptionService.
 * Behavior is delegated 1:1 to EncryptionService (generateSecret/encryptSecret/decryptSecret).
 */
@Injectable()
export class EncryptionAdapter implements EncryptionPort {
  constructor(private readonly encryptionService: EncryptionService) {}

  generateSecret(): string {
    return this.encryptionService.generateSecret();
  }

  encryptSecret(secret: string): string {
    return this.encryptionService.encryptSecret(secret);
  }

  decryptSecret(encryptedSecret: string): string {
    return this.encryptionService.decryptSecret(encryptedSecret);
  }
}

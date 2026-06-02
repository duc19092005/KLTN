import { Injectable } from '@nestjs/common';
import { ZkpService } from '../../../zkp/services/zkp.service';
import { ZkpSecretCipherPort } from '../../application/ports/zkp-secret-cipher.port';

/**
 * Adapter binding the ZKP secret cipher port to the concrete ZkpService.
 * Behavior is delegated 1:1 to ZkpService (generateSecret/encryptSecret/decryptSecret).
 */
@Injectable()
export class ZkpSecretCipherAdapter implements ZkpSecretCipherPort {
  constructor(private readonly zkp: ZkpService) {}

  generateSecret(): string {
    return this.zkp.generateSecret();
  }

  encryptSecret(secret: string): string {
    return this.zkp.encryptSecret(secret);
  }

  decryptSecret(encryptedSecret: string): string {
    return this.zkp.decryptSecret(encryptedSecret);
  }
}

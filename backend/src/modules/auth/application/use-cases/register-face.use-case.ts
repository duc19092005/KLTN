import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { AUTH_REPOSITORY, AuthRepositoryPort } from '../ports/auth.repository.port';
import { ENCRYPTION_PORT, EncryptionPort } from '../ports/encryption.port';
import { AUTH_CHAIN_GATEWAY, AuthChainGatewayPort } from '../ports/auth-chain-gateway.port';
import { SECURITY_EVENT_LOGGER, SecurityEventLoggerPort } from '../ports/security-event-logger.port';
import { AuthUserLookupService } from '../services/auth-user-lookup.service';
import { hashToBytes32 } from '../../../../infrastructure/audit/audit-hash.util';
import { FACE_MODEL_VERSION } from '../../domain/auth.constants';
import { computeFaceHash, validateFaceDescriptorSet } from '../../domain/face.util';

/**
 * Enrolls a multi-sample face template. Behavior copied verbatim from the former
 * AuthService.registerFace(): validates 3-15 descriptors, encrypts + hashes the
 * template, persists enrollment, anchors the integrity hash on-chain (non-fatal),
 * and audits.
 */
@Injectable()
export class RegisterFaceUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repo: AuthRepositoryPort,
    @Inject(ENCRYPTION_PORT) private readonly cipher: EncryptionPort,
    @Inject(AUTH_CHAIN_GATEWAY) private readonly chain: AuthChainGatewayPort,
    @Inject(SECURITY_EVENT_LOGGER) private readonly audit: SecurityEventLoggerPort,
    private readonly lookup: AuthUserLookupService,
  ) {}

  async execute(userId: string, embedding: number[] | number[][]) {
    const descriptors = validateFaceDescriptorSet(embedding);
    const user = await this.lookup.getAuthUser(userId);

    if (!user.firstLogin && user.faceEmbedding) {
      throw new ForbiddenException('Dữ liệu khuôn mặt đã được đăng ký.');
    }

    const faceEmbeddingJson = JSON.stringify(descriptors);
    const faceHash = computeFaceHash(descriptors);
    const encryptedFaceEmbedding = this.cipher.encryptSecret(faceEmbeddingJson);

    await this.repo.updateFaceEnrollment(userId, {
      faceEmbedding: encryptedFaceEmbedding,
      faceHash,
      faceModelVersion: FACE_MODEL_VERSION,
      faceSampleCount: descriptors.length,
      registrationStep: Math.max(user.registrationStep ?? 1, 2),
    });

    // Anchor the face-template integrity hash on-chain (FaceRegistry). Non-fatal: if the
    // chain is unavailable the template is simply not yet protected by the integrity gate;
    // it can be re-anchored later. The login gate treats a missing anchor as "skip".
    const chainResult = await this.chain.setFaceHash(userId, hashToBytes32(faceHash));

    await this.audit.write(userId, 'FACE_ENROLL', 'User', userId, {
      sampleCount: descriptors.length,
      modelVersion: FACE_MODEL_VERSION,
      onChain: chainResult.success ? 'ANCHORED' : 'UNANCHORED',
      txHash: (chainResult as any).txHash || null,
    });

    return {
      registered: true,
      algorithm: `${FACE_MODEL_VERSION}/multi-sample`,
      descriptorLength: descriptors[0].length,
      descriptorCount: descriptors.length,
      registrationStep: 2,
    };
  }
}

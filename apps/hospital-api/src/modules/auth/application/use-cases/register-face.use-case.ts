import { ForbiddenException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AUTH_REPOSITORY, AuthRepositoryPort } from '../ports/auth.repository.port';
import { ENCRYPTION_PORT, EncryptionPort } from '../ports/encryption.port';
import { AUTH_CHAIN_GATEWAY, AuthChainGatewayPort } from '../ports/auth-chain-gateway.port';
import { SECURITY_EVENT_LOGGER, SecurityEventLoggerPort } from '../ports/security-event-logger.port';
import { AuthUserLookupService } from '../services/auth-user-lookup.service';
import { hashToBytes32 } from '../../../../infrastructure/audit';
import { FACE_MODEL_VERSION } from '../../domain/auth.constants';
import { computeFaceHash, validateFaceDescriptorSet } from '../../domain/face.util';
import {
  FACE_RECOVERY_ARTIFACT,
  FaceRecoveryArtifactPort,
} from '../ports/face-recovery-artifact.port';

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
    @Inject(FACE_RECOVERY_ARTIFACT) private readonly recoveryArtifact: FaceRecoveryArtifactPort,
    private readonly lookup: AuthUserLookupService,
  ) {}

  async execute(userId: string, embedding: number[] | number[][]) {
    const descriptors = validateFaceDescriptorSet(embedding);
    const user = await this.lookup.getAuthUser(userId);

    if (!user.firstLogin) {
      throw new ForbiddenException('Dữ liệu khuôn mặt đã được đăng ký.');
    }

    if (user.role === 'ADMIN' && (await this.chain.getFaceRecovery(userId))) {
      throw new ForbiddenException({
        code: 'FACE_TEMPLATE_ALREADY_ANCHORED',
        message: 'Tài khoản Admin đã có dữ liệu khuôn mặt được neo trên blockchain; không thể đăng ký lại.',
      });
    }

    const faceEmbeddingJson = JSON.stringify(descriptors);
    const faceHash = computeFaceHash(descriptors);
    const encryptedFaceEmbedding = this.cipher.encryptSecret(faceEmbeddingJson);

    const enrollment = {
      faceEmbedding: encryptedFaceEmbedding,
      faceHash,
      faceModelVersion: FACE_MODEL_VERSION,
      faceSampleCount: descriptors.length,
      registrationStep: Math.max(user.registrationStep ?? 1, 2),
    };

    let chainResult;
    if (user.role === 'ADMIN') {
      try {
        const artifact = await this.recoveryArtifact.createAndUpload(
          userId,
          descriptors,
          faceHash,
          FACE_MODEL_VERSION,
        );
        chainResult = await this.chain.setFaceRecovery(
          userId,
          hashToBytes32(faceHash),
          artifact.artifactHash,
          artifact.artifactUri,
        );
      } catch {
        await this.audit.write(userId, 'ADMIN_FACE_RECOVERY_ENROLLMENT_FAILED', 'User', userId, {
          stage: 'ARTIFACT_UPLOAD',
        });
        throw new ServiceUnavailableException(
          'Không thể tạo bản phục hồi khuôn mặt Admin. Dữ liệu chưa được đăng ký.',
        );
      }

      if (!chainResult.success) {
        await this.audit.write(userId, 'ADMIN_FACE_RECOVERY_ENROLLMENT_FAILED', 'User', userId, {
          stage: 'BLOCKCHAIN_ANCHOR',
        });
        throw new ServiceUnavailableException(
          'Không thể neo bản phục hồi khuôn mặt Admin trên blockchain. Dữ liệu chưa được đăng ký.',
        );
      }
      await this.repo.updateFaceEnrollment(userId, enrollment);
    } else {
      await this.repo.updateFaceEnrollment(userId, enrollment);
      chainResult = await this.chain.setFaceHash(userId, hashToBytes32(faceHash));
    }

    await this.audit.write(userId, 'FACE_ENROLL', 'User', userId, {
      sampleCount: descriptors.length,
      modelVersion: FACE_MODEL_VERSION,
      onChain: chainResult.success ? 'ANCHORED' : 'UNANCHORED',
      txHash: chainResult.txHash || null,
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

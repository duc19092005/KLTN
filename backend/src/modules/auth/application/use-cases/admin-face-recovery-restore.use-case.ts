import {
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { AUTH_REPOSITORY, AuthRepositoryPort } from '../ports/auth.repository.port';
import { ACCESS_TOKEN_SIGNER, AccessTokenSignerPort } from '../ports/access-token-signer.port';
import { AUTH_CHAIN_GATEWAY, AuthChainGatewayPort } from '../ports/auth-chain-gateway.port';
import {
  FACE_RECOVERY_ARTIFACT,
  FaceRecoveryArtifactPort,
  RecoveredFaceTemplate,
} from '../ports/face-recovery-artifact.port';
import { ENCRYPTION_PORT, EncryptionPort } from '../ports/encryption.port';
import { SECURITY_EVENT_LOGGER, SecurityEventLoggerPort } from '../ports/security-event-logger.port';
import { AuthUserLookupService } from '../services/auth-user-lookup.service';
import { FaceMatchService } from '../services/face-match.service';
import { assertNotFaceLocked, computeFaceHash, validateFaceDescriptor } from '../../domain/face.util';
import { toPublicUser } from '../../domain/public-user';

@Injectable()
export class AdminFaceRecoveryRestoreUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repo: AuthRepositoryPort,
    @Inject(ACCESS_TOKEN_SIGNER) private readonly tokenSigner: AccessTokenSignerPort,
    @Inject(AUTH_CHAIN_GATEWAY) private readonly chain: AuthChainGatewayPort,
    @Inject(FACE_RECOVERY_ARTIFACT) private readonly artifact: FaceRecoveryArtifactPort,
    @Inject(ENCRYPTION_PORT) private readonly cipher: EncryptionPort,
    @Inject(SECURITY_EVENT_LOGGER) private readonly audit: SecurityEventLoggerPort,
    private readonly lookup: AuthUserLookupService,
    private readonly faceMatch: FaceMatchService,
  ) {}

  async execute(
    userId: string,
    embedding: number[],
    challenge: string,
    tokenWalletAddress?: string,
    ip?: string,
  ) {
    const descriptor = validateFaceDescriptor(embedding);
    const user = await this.lookup.getAuthUser(userId);
    await this.assertAdminWalletSession(user, tokenWalletAddress);
    assertNotFaceLocked(user);

    const consumed = await this.repo.consumeFaceChallenge(userId, challenge, new Date());
    if (consumed !== 1) {
      throw new UnauthorizedException('Yêu cầu phục hồi khuôn mặt đã hết hạn hoặc không hợp lệ.');
    }

    const checkpoint = await this.chain.getFaceRecovery(userId);
    if (!checkpoint) {
      throw new ServiceUnavailableException({
        code: 'FACE_RECOVERY_UNAVAILABLE',
        message: 'Bản phục hồi khuôn mặt Admin không khả dụng.',
      });
    }

    let recoveredTemplate: RecoveredFaceTemplate;
    try {
      recoveredTemplate = await this.artifact.downloadAndVerify(userId, checkpoint);
    } catch {
      await this.audit.write(userId, 'ADMIN_FACE_RECOVERY_ARTIFACT_FAILED', 'User', userId, { ip });
      throw new ServiceUnavailableException({
        code: 'FACE_RECOVERY_UNAVAILABLE',
        message: 'Bản phục hồi khuôn mặt Admin không toàn vẹn hoặc không thể giải mã.',
      });
    }

    const { descriptors: storedDescriptors, modelVersion } = recoveredTemplate;

    const match = this.faceMatch.computeMatch(descriptor, storedDescriptors);
    if (!match.passed) {
      const lockInfo = await this.faceMatch.recordFailure(user);
      await this.audit.write(userId, 'ADMIN_FACE_RECOVERY_MATCH_FAILED', 'User', userId, {
        failedAttempts: lockInfo.failedAttempts,
        locked: lockInfo.locked,
        ip,
      });
      throw new UnauthorizedException(
        lockInfo.locked
          ? 'Thử sai quá nhiều lần. Tài khoản tạm thời bị khóa.'
          : 'Khuôn mặt hiện tại không khớp với bản phục hồi Admin.',
      );
    }

    const faceHash = computeFaceHash(storedDescriptors);
    const restoredUser = await this.repo.restoreFaceEnrollmentAndInvalidateSessions(userId, {
      faceEmbedding: this.cipher.encryptSecret(JSON.stringify(storedDescriptors)),
      faceHash,
      faceModelVersion: modelVersion,
      faceSampleCount: storedDescriptors.length,
      registrationStep: user.registrationStep,
    });

    await this.audit.write(userId, 'ADMIN_FACE_RESTORED_FROM_IPFS', 'User', userId, {
      sampleCount: storedDescriptors.length,
      modelVersion,
      checkpointUpdatedAt: checkpoint.updatedAt,
      ip,
    });

    return {
      access_token: this.tokenSigner.sign(restoredUser, {
        verified: true,
        walletAddress: restoredUser.adminProfile?.walletAddress,
      }),
      restored: true,
      verified: true,
      user: toPublicUser(restoredUser, true),
    };
  }

  private async assertAdminWalletSession(
    user: Awaited<ReturnType<AuthUserLookupService['getAuthUser']>>,
    tokenWalletAddress?: string,
  ): Promise<void> {
    const wallet = user.adminProfile?.walletAddress;
    if (
      user.role !== 'ADMIN' ||
      user.status !== 'ACTIVE' ||
      user.firstLogin ||
      !wallet ||
      !tokenWalletAddress ||
      wallet.toLowerCase() !== tokenWalletAddress.toLowerCase()
    ) {
      throw new UnauthorizedException('Phiên ví Admin không hợp lệ để phục hồi khuôn mặt.');
    }
    if (!(await this.chain.isAuthorized(tokenWalletAddress))) {
      throw new UnauthorizedException('Ví Admin không còn được cấp quyền trên blockchain.');
    }
  }
}

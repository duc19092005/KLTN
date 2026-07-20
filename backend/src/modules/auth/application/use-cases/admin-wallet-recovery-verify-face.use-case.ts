import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { AUTH_REPOSITORY, AuthRepositoryPort } from '../ports/auth.repository.port';
import { SECURITY_EVENT_LOGGER, SecurityEventLoggerPort } from '../ports/security-event-logger.port';
import { AdminWalletRecoveryContextService } from '../services/admin-wallet-recovery-context.service';
import { FaceMatchService } from '../services/face-match.service';
import { assertNotFaceLocked, validateFaceDescriptor } from '../../domain/face.util';

@Injectable()
export class AdminWalletRecoveryVerifyFaceUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repo: AuthRepositoryPort,
    @Inject(SECURITY_EVENT_LOGGER) private readonly audit: SecurityEventLoggerPort,
    private readonly context: AdminWalletRecoveryContextService,
    private readonly faceMatch: FaceMatchService,
  ) {}

  async execute(embedding: number[], challenge: string, ip?: string) {
    const descriptor = validateFaceDescriptor(embedding);
    const admin = await this.context.getSoleActiveAdmin();
    if (!admin.faceEmbedding) {
      throw new UnauthorizedException('Admin chưa đăng ký dữ liệu khuôn mặt.');
    }
    assertNotFaceLocked(admin);

    const consumed = await this.repo.consumeFaceChallenge(admin.id, challenge, new Date());
    if (consumed !== 1) {
      throw new UnauthorizedException('Yêu cầu xác thực khuôn mặt đã hết hạn hoặc không hợp lệ.');
    }

    const storedDescriptors = this.faceMatch.decodeStoredDescriptors(admin.faceEmbedding);
    const integrity = await this.faceMatch.checkIntegrity(admin.id, storedDescriptors, true);
    if (!integrity.ok) {
      await this.audit.write(admin.id, 'ADMIN_WALLET_RECOVERY_FACE_INTEGRITY_FAILED', 'User', admin.id, { ip });
      throw new UnauthorizedException('Dữ liệu khuôn mặt Admin đã bị thay đổi. Không thể khôi phục ví.');
    }

    const match = this.faceMatch.computeMatch(descriptor, storedDescriptors);
    if (!match.passed) {
      const lockInfo = await this.faceMatch.recordFailure(admin);
      await this.audit.write(admin.id, 'ADMIN_WALLET_RECOVERY_FACE_FAILED', 'User', admin.id, {
        failedAttempts: lockInfo.failedAttempts,
        locked: lockInfo.locked,
        ip,
      });
      throw new UnauthorizedException(
        lockInfo.locked ? 'Thử sai quá nhiều lần. Tài khoản tạm thời bị khóa.' : 'Xác thực khuôn mặt thất bại.',
      );
    }

    await this.faceMatch.resetFailures(admin.id);
    await this.audit.write(admin.id, 'ADMIN_WALLET_RECOVERY_FACE_VERIFIED', 'User', admin.id, { ip });

    return {
      recoveryToken: this.context.issueRecoveryToken(admin),
      expiresInSeconds: 300,
    };
  }
}

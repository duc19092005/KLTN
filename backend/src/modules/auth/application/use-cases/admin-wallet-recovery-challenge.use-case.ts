import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { AUTH_REPOSITORY, AuthRepositoryPort } from '../ports/auth.repository.port';
import { SECURITY_EVENT_LOGGER, SecurityEventLoggerPort } from '../ports/security-event-logger.port';
import { AdminWalletRecoveryContextService } from '../services/admin-wallet-recovery-context.service';
import { FACE_CHALLENGE_TTL_MS } from '../../domain/auth.constants';
import { assertNotFaceLocked } from '../../domain/face.util';

@Injectable()
export class AdminWalletRecoveryChallengeUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repo: AuthRepositoryPort,
    @Inject(SECURITY_EVENT_LOGGER) private readonly audit: SecurityEventLoggerPort,
    private readonly context: AdminWalletRecoveryContextService,
  ) {}

  async execute() {
    const admin = await this.context.getSoleActiveAdmin();
    if (!admin.faceEmbedding) {
      throw new UnauthorizedException('Admin chưa đăng ký dữ liệu khuôn mặt để khôi phục ví.');
    }
    assertNotFaceLocked(admin);

    const challenge = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + FACE_CHALLENGE_TTL_MS);
    await this.repo.setFaceChallenge(admin.id, challenge, expiresAt);
    await this.audit.write(admin.id, 'ADMIN_WALLET_RECOVERY_CHALLENGE_ISSUED', 'User', admin.id);

    return { challenge, expiresAt: expiresAt.toISOString(), ttlMs: FACE_CHALLENGE_TTL_MS };
  }
}

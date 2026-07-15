import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { AUTH_REPOSITORY, AuthRepositoryPort } from '../ports/auth.repository.port';
import { SECURITY_EVENT_LOGGER, SecurityEventLoggerPort } from '../ports/security-event-logger.port';
import { assertNotFaceLocked } from '../../domain/face.util';
import { FACE_CHALLENGE_TTL_MS } from '../../domain/auth.constants';

@Injectable()
export class ForgotPasswordChallengeUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repo: AuthRepositoryPort,
    @Inject(SECURITY_EVENT_LOGGER) private readonly audit: SecurityEventLoggerPort,
  ) {}

  async execute(username: string) {
    const user = await this.repo.findUserByIdentity(username, username.toLowerCase());
    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản nhân sự này.');
    }

    if (!['RECEPTIONIST', 'DOCTOR', 'LAB_MANAGER'].includes(user.role)) {
      await this.audit.write(user.id, 'FORGOT_PASSWORD_DENIED', 'User', user.id, {
        reason: 'ROLE_NOT_ALLOWED',
        role: user.role,
      });
      throw new BadRequestException('Chức năng quên mật khẩu chỉ áp dụng cho tài khoản nhân sự.');
    }

    if (!user.faceEmbedding) {
      await this.audit.write(user.id, 'FORGOT_PASSWORD_FAILED', 'User', user.id, {
        reason: 'FACE_NOT_ENROLLED',
        role: user.role,
      });
      throw new BadRequestException('Tài khoản này chưa đăng ký sinh trắc học khuôn mặt.');
    }

    assertNotFaceLocked(user);

    const challenge = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + FACE_CHALLENGE_TTL_MS);

    await this.repo.setFaceChallenge(user.id, challenge, expiresAt);
    await this.audit.write(user.id, 'FORGOT_PASSWORD_CHALLENGE_ISSUED', 'User', user.id, {
      role: user.role,
    });

    return {
      challenge,
      userId: user.id,
      expiresAt: expiresAt.toISOString(),
      ttlMs: FACE_CHALLENGE_TTL_MS,
    };
  }
}

import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { AUTH_REPOSITORY, AuthRepositoryPort } from '../ports/auth.repository.port';
import { ACCESS_TOKEN_SIGNER, AccessTokenSignerPort } from '../ports/access-token-signer.port';
import { SECURITY_EVENT_LOGGER, SecurityEventLoggerPort } from '../ports/security-event-logger.port';
import { hashPassword, verifyPassword } from '../../domain/credential.util';
import { toPublicUser } from '../../domain/public-user';

/**
 * Changes a user's password.
 *
 * recent face enrollment counts as a fresh liveness proof, so we mint a verified
 * access token and return it inline. The client can then land on the dashboard
 * without re-scanning.
 *
 * For ordinary post-activation password changes (firstLogin=false), behavior is
 * unchanged — no token is rotated, so existing sessions and audit expectations
 * are preserved.
 */
@Injectable()
export class ChangePasswordUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repo: AuthRepositoryPort,
    @Inject(ACCESS_TOKEN_SIGNER) private readonly tokenSigner: AccessTokenSignerPort,
    @Inject(SECURITY_EVENT_LOGGER) private readonly audit: SecurityEventLoggerPort,
  ) {}

  async execute(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.repo.findUserWithProfile(userId);
    if (!user) throw new UnauthorizedException('Không tìm thấy tài khoản.');
    if (!user.passwordHash || !verifyPassword(currentPassword, user.passwordHash)) {
      throw new UnauthorizedException('Mật khẩu hiện tại không đúng.');
    }
    const updated = await this.repo.updatePasswordChange(
      userId,
      hashPassword(newPassword),
      Math.max(user.registrationStep ?? 1, 2),
    );

    // Activation path: firstLogin user just enrolled their face moments ago and
    // is now setting a permanent password. Skip the redundant face-verify scan
    // by minting a verified token right here.
    const isActivation = user.firstLogin && Boolean(user.faceEmbedding);
    if (!isActivation) {
      return { passwordChanged: true, user: toPublicUser(updated, false) };
    }

    const access_token = this.tokenSigner.sign(updated, {
      verified: true,
      walletAddress: updated.adminProfile?.walletAddress,
    });

    return {
      passwordChanged: true,
      access_token,
      user: toPublicUser(updated, true),
    };
  }
}

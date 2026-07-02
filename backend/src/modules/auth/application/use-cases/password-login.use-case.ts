import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { AUTH_REPOSITORY, AuthRepositoryPort } from '../ports/auth.repository.port';
import { ACCESS_TOKEN_SIGNER, AccessTokenSignerPort } from '../ports/access-token-signer.port';
import { SECURITY_EVENT_LOGGER, SecurityEventLoggerPort } from '../ports/security-event-logger.port';
import { verifyPassword } from '../../domain/credential.util';
import { toPublicUser } from '../../domain/public-user';

/**
 * Password login for non-admin staff. Behavior copied verbatim from the former
 * AuthService.loginWithPassword(): rejects admins/invalid/inactive accounts with
 * the same audit trail, then returns role-specific next-step flags.
 */
@Injectable()
export class PasswordLoginUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repo: AuthRepositoryPort,
    @Inject(ACCESS_TOKEN_SIGNER) private readonly tokenSigner: AccessTokenSignerPort,
    @Inject(SECURITY_EVENT_LOGGER) private readonly audit: SecurityEventLoggerPort,
  ) {}

  async execute(usernameOrEmail: string, password: string) {
    const identity = usernameOrEmail.trim();
    const user = await this.repo.findUserByIdentity(identity, identity.toLowerCase());

    if (!user || user.role === 'ADMIN') {
      // No valid user or admin accounts must not use this flow.
      await this.audit.write(null, 'LOGIN_FAIL', 'User', user?.id ?? 'unknown', {
        method: 'PASSWORD',
        reason: 'invalid_credentials',
        attemptedIdentity: identity,
      });
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng.');
    }
    if (user.status !== 'ACTIVE') {
      await this.audit.write(user.id, 'LOGIN_FAIL', 'User', user.id, { method: 'PASSWORD', reason: 'inactive_account' });
      throw new UnauthorizedException('Tài khoản chưa được kích hoạt hoặc đã bị khóa.');
    }
    if (!user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      await this.audit.write(user.id, 'LOGIN_FAIL', 'User', user.id, { method: 'PASSWORD', reason: 'wrong_password' });
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng.');
    }

    await this.audit.write(user.id, 'LOGIN_PASSWORD', 'User', user.id, { method: 'PASSWORD', role: user.role });

    return {
      access_token: this.tokenSigner.sign(user, { verified: true }),
      requirePasswordChange: user.firstLogin,
      requireFaceRegistration: user.firstLogin || !user.faceEmbedding,
      requireFaceVerification: false,
      user: toPublicUser(user, true),
    };
  }
}

import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { AUTH_REPOSITORY, AuthRepositoryPort } from '../ports/auth.repository.port';
import { ACCESS_TOKEN_SIGNER, AccessTokenSignerPort } from '../ports/access-token-signer.port';
import { SECURITY_EVENT_LOGGER, SecurityEventLoggerPort } from '../ports/security-event-logger.port';
import { hashInviteToken } from '../../domain/credential.util';
import { toPublicUser } from '../../domain/public-user';

/**
 * Admin first-login via invite token. Behavior copied verbatim from the former
 * AuthService.loginWithInviteToken(): accepts hashed or legacy raw token,
 * validates role/firstLogin/expiry, upgrades a legacy token to its hash, audits,
 * then issues an unverified first-login token.
 */
@Injectable()
export class InviteLoginUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repo: AuthRepositoryPort,
    @Inject(ACCESS_TOKEN_SIGNER) private readonly tokenSigner: AccessTokenSignerPort,
    @Inject(SECURITY_EVENT_LOGGER) private readonly audit: SecurityEventLoggerPort,
  ) {}

  async execute(inviteToken: string) {
    const trimmedToken = inviteToken.trim();
    const tokenHash = hashInviteToken(trimmedToken);
    const user = await this.repo.findUserByInviteTokenCandidates([tokenHash, trimmedToken]);

    if (!user) throw new UnauthorizedException('Invalid invite token');
    if (user.role !== 'ADMIN') throw new UnauthorizedException('Invite token is not for Admin');
    if (!user.firstLogin) throw new UnauthorizedException('Invite token already used');
    // Trace: admin first-login via invite token (success path continues below).
    if (user.inviteTokenExpiry && user.inviteTokenExpiry < new Date()) {
      throw new UnauthorizedException('Invite token has expired');
    }

    if (user.inviteToken !== tokenHash) {
      await this.repo.updateInviteTokenHash(user.id, tokenHash);
    }

    await this.audit.write(user.id, 'LOGIN_INVITE', 'User', user.id, { method: 'INVITE_TOKEN', role: user.role });

    return {
      access_token: this.tokenSigner.sign(user, { verified: false, isFirstLogin: true }),
      firstLogin: true,
      requireRegistration: true,
      user: toPublicUser(user, false),
    };
  }
}

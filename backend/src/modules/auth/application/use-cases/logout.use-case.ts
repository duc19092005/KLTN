import { Inject, Injectable } from '@nestjs/common';
import { AUTH_REPOSITORY, AuthRepositoryPort } from '../ports/auth.repository.port';
import { ACCESS_TOKEN_SIGNER, AccessTokenSignerPort } from '../ports/access-token-signer.port';

/**
 * Logout: bumps the user's tokenVersion to invalidate outstanding JWTs.
 * Behavior copied verbatim from the former AuthService.logout()/logoutToken():
 * logoutToken tolerantly verifies the token (expired/malformed is a no-op) and,
 * if it has a sub, bumps that user's tokenVersion.
 */
@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repo: AuthRepositoryPort,
    @Inject(ACCESS_TOKEN_SIGNER) private readonly tokenSigner: AccessTokenSignerPort,
  ) {}

  async logout(userId: string): Promise<void> {
    await this.repo.bumpTokenVersion(userId);
  }

  async logoutToken(token?: string): Promise<void> {
    if (!token) return;
    const sub = this.tokenSigner.verifySub(token);
    if (sub) {
      await this.logout(sub);
    }
  }
}

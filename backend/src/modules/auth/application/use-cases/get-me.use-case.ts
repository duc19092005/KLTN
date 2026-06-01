import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { AUTH_REPOSITORY, AuthRepositoryPort } from '../ports/auth.repository.port';
import { toPublicUser } from '../../domain/public-user';

/**
 * Returns the current user's public profile. Behavior copied verbatim from the
 * former AuthService.getMe(): verified is only true when the token says so AND
 * the account is active and past first-login.
 */
@Injectable()
export class GetMeUseCase {
  constructor(@Inject(AUTH_REPOSITORY) private readonly repo: AuthRepositoryPort) {}

  async execute(userId: string, verified: boolean) {
    const user = await this.repo.findUserWithProfile(userId);
    if (!user) throw new UnauthorizedException('User not found');

    const isVerified = Boolean(verified) && user.status === 'ACTIVE' && !user.firstLogin;
    return { user: toPublicUser(user, isVerified) };
  }
}

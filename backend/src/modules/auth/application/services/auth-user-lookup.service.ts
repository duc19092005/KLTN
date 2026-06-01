import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { AUTH_REPOSITORY, AuthRepositoryPort, UserWithProfile } from '../ports/auth.repository.port';

/**
 * Shared user lookups with status/role guards, extracted verbatim from the
 * former AuthService.getAuthUser() and getAdminUser().
 */
@Injectable()
export class AuthUserLookupService {
  constructor(@Inject(AUTH_REPOSITORY) private readonly repo: AuthRepositoryPort) {}

  async getAuthUser(userId: string): Promise<UserWithProfile> {
    const user = await this.repo.findUserWithProfile(userId);
    if (!user) throw new UnauthorizedException('User not found');
    if (user.status === 'INACTIVE') throw new UnauthorizedException('Account suspended');
    return user;
  }

  async getAdminUser(userId: string): Promise<UserWithProfile> {
    const user = await this.repo.findUserWithProfile(userId);
    if (!user || user.role !== 'ADMIN' || !user.adminProfile) {
      throw new UnauthorizedException('Admin not found');
    }
    if (user.status === 'INACTIVE') {
      throw new UnauthorizedException('Account suspended');
    }
    return user;
  }
}

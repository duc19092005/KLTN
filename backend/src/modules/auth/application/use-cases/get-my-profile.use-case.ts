import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { AUTH_REPOSITORY, AuthRepositoryPort } from '../ports/auth.repository.port';
import { toPublicProfile } from '../../domain/public-profile';

/**
 * Returns the current user's full personal information (Xem thông tin cá nhân).
 *
 * Read-only: fetches the identity graph (admin/staff/department/doctor) and maps
 * it through `toPublicProfile`, which strips every secret/biometric field.
 */
@Injectable()
export class GetMyProfileUseCase {
  constructor(@Inject(AUTH_REPOSITORY) private readonly repo: AuthRepositoryPort) {}

  async execute(userId: string) {
    const user = await this.repo.findUserFullProfile(userId);
    if (!user) throw new UnauthorizedException('Không tìm thấy tài khoản.');

    return { profile: toPublicProfile(user) };
  }
}

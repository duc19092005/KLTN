import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { AUTH_REPOSITORY, AuthRepositoryPort } from '../ports/auth.repository.port';
import { hashPassword, verifyPassword } from '../../domain/credential.util';
import { toPublicUser } from '../../domain/public-user';

/**
 * Changes a user's password. Behavior copied verbatim from the former
 * AuthService.changePassword(): verifies the current password, sets the new
 * hash, clears firstLogin, and advances registrationStep to >= 2.
 */
@Injectable()
export class ChangePasswordUseCase {
  constructor(@Inject(AUTH_REPOSITORY) private readonly repo: AuthRepositoryPort) {}

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
    return { passwordChanged: true, user: toPublicUser(updated, false) };
  }
}

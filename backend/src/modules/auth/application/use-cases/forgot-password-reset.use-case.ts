import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AUTH_REPOSITORY, AuthRepositoryPort } from '../ports/auth.repository.port';
import { SECURITY_EVENT_LOGGER, SecurityEventLoggerPort } from '../ports/security-event-logger.port';
import { hashPassword } from '../../domain/credential.util';

@Injectable()
export class ForgotPasswordResetUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repo: AuthRepositoryPort,
    @Inject(SECURITY_EVENT_LOGGER) private readonly audit: SecurityEventLoggerPort,
    private readonly jwtService: JwtService,
  ) {}

  async execute(resetToken: string, newPassword: string, ip?: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(resetToken);
    } catch (err) {
      throw new UnauthorizedException('Mã xác thực đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
    }

    if (payload.purpose !== 'reset-password' || !payload.sub) {
      throw new UnauthorizedException('Mã xác thực không hợp lệ.');
    }

    const userId = payload.sub;
    const user = await this.repo.findUserWithProfile(userId);
    if (!user) {
      throw new UnauthorizedException('Không tìm thấy tài khoản nhân sự.');
    }

    const newPasswordHash = hashPassword(newPassword);
    
    // Reset password and advance registration step if needed
    await this.repo.updatePasswordChange(
      userId,
      newPasswordHash,
      Math.max(user.registrationStep ?? 1, 2),
    );

    // Bump token version to invalidate any existing login sessions
    await this.repo.bumpTokenVersion(userId);

    await this.audit.write(userId, 'PASSWORD_RESET_SUCCESS', 'User', userId, { ip });

    return {
      success: true,
      message: 'Đặt lại mật khẩu mới thành công.',
    };
  }
}

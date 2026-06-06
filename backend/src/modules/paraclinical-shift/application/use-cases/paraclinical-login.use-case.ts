import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import {
  PARACLINICAL_SHIFT_REPOSITORY,
  ParaclinicalShiftRepositoryPort,
} from '../ports/paraclinical-shift.repository.port';
import { SECURITY_EVENT_LOGGER, SecurityEventLoggerPort } from '../../../auth/application/ports/security-event-logger.port';
import { PARACLINICAL_TEMP_TOKEN_TTL_MINUTES } from '../../domain/shift.constants';

/**
 * Phase 1 of shared-account login:
 * Validate the shared username/password → issue a short-lived temporary token
 * that authorizes the face-scan step but carries NO deep permissions.
 */
@Injectable()
export class ParaclinicalLoginUseCase {
  constructor(
    @Inject(PARACLINICAL_SHIFT_REPOSITORY) private readonly repo: ParaclinicalShiftRepositoryPort,
    @Inject(SECURITY_EVENT_LOGGER) private readonly logger: SecurityEventLoggerPort,
    private readonly jwtService: JwtService,
  ) {}

  async execute(username: string, password: string) {
    const user = await this.repo.findUserByUsername(username);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng.');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Tài khoản đã bị vô hiệu hóa.');
    }

    // Only DEPT_SHARED accounts can login via the shared-account flow.
    // LAB_MANAGER (department heads) must use the standard /auth/login endpoint.
    if (user.role !== 'DEPT_SHARED') {
      throw new UnauthorizedException('Tài khoản này không phải tài khoản chung phòng ban. Vui lòng đăng nhập qua trang chính.');
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      await this.logger.write(null, 'PARACLINICAL_LOGIN_FAILED', 'User', user.id, {
        reason: 'Invalid password',
        username,
      });
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng.');
    }

    // Issue a temporary token (limited scope: face-scan only)
    const tempToken = this.jwtService.sign(
      {
        sub: user.id,
        purpose: 'paraclinical-face-scan',
        username: user.username,
      },
      { expiresIn: `${PARACLINICAL_TEMP_TOKEN_TTL_MINUTES}m` },
    );

    await this.logger.write(user.id, 'PARACLINICAL_LOGIN_PHASE1', 'User', user.id, {
      username,
    });

    return {
      tempToken,
      userId: user.id,
      message: 'Xác thực mật khẩu thành công. Vui lòng quét khuôn mặt để tiếp tục.',
    };
  }
}

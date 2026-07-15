import { Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { AUTH_REPOSITORY, AuthRepositoryPort, UserWithProfile } from '../ports/auth.repository.port';
import {
  ADMIN_WALLET_RECOVERY_TOKEN_PURPOSE,
  ADMIN_WALLET_RECOVERY_TOKEN_TTL,
} from '../../domain/auth.constants';

type RecoveryTokenPayload = {
  sub: string;
  purpose: string;
  tokenVersion: number;
  jti: string;
};

@Injectable()
export class AdminWalletRecoveryContextService {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repo: AuthRepositoryPort,
    private readonly jwtService: JwtService,
  ) {}

  async getSoleActiveAdmin(): Promise<UserWithProfile> {
    const admins = await this.repo.findAdminUsers(2);
    if (admins.length !== 1) {
      throw new ServiceUnavailableException(
        'Hệ thống không xác định được tài khoản Admin duy nhất. Vui lòng kiểm tra dữ liệu quản trị.',
      );
    }

    const admin = admins[0];
    if (admin.status !== 'ACTIVE' || admin.firstLogin || admin.deletedAt || !admin.adminProfile) {
      throw new ServiceUnavailableException('Tài khoản Admin chưa ở trạng thái cho phép khôi phục.');
    }
    return admin;
  }

  issueRecoveryToken(admin: UserWithProfile): string {
    return this.jwtService.sign(
      {
        sub: admin.id,
        purpose: ADMIN_WALLET_RECOVERY_TOKEN_PURPOSE,
        tokenVersion: admin.tokenVersion,
        jti: crypto.randomUUID(),
      } satisfies RecoveryTokenPayload,
      { expiresIn: ADMIN_WALLET_RECOVERY_TOKEN_TTL },
    );
  }

  verifyRecoveryToken(token: string, admin: UserWithProfile): RecoveryTokenPayload {
    let payload: RecoveryTokenPayload;
    try {
      payload = this.jwtService.verify<RecoveryTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Phiên khôi phục Admin không hợp lệ hoặc đã hết hạn.');
    }

    if (
      payload.purpose !== ADMIN_WALLET_RECOVERY_TOKEN_PURPOSE ||
      payload.sub !== admin.id ||
      payload.tokenVersion !== admin.tokenVersion ||
      !payload.jti
    ) {
      throw new UnauthorizedException('Phiên khôi phục Admin không hợp lệ.');
    }
    return payload;
  }
}

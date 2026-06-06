import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { AUTH_REPOSITORY, AuthRepositoryPort } from '../ports/auth.repository.port';
import { INVITE_TOKEN_TTL_MS } from '../../domain/auth.constants';
import { hashInviteToken, timingSafeEquals } from '../../domain/credential.util';

/**
 * Creates the first Admin account guarded by the bootstrap secret. Behavior
 * copied verbatim from the former AuthService.bootstrapFirstAdmin().
 */
@Injectable()
export class BootstrapAdminUseCase {
  constructor(@Inject(AUTH_REPOSITORY) private readonly repo: AuthRepositoryPort) {}

  async execute(username: string, email: string, superAdminSecret: string) {
    const bootstrapSecret = process.env.BOOTSTRAP_ADMIN_SECRET || process.env.SUPER_ADMIN_PRIVATE_KEY;
    if (!bootstrapSecret || bootstrapSecret === 'your_super_admin_private_key_here') {
      throw new ForbiddenException('Chưa cấu hình khóa khởi tạo quản trị viên.');
    }

    if (!timingSafeEquals(superAdminSecret, bootstrapSecret)) {
      throw new ForbiddenException('Khóa khởi tạo quản trị viên không hợp lệ.');
    }

    const existingAdmin = await this.repo.findFirstAdmin();
    if (existingAdmin) {
      throw new ForbiddenException('Tài khoản quản trị đã tồn tại.');
    }

    const rawInviteToken = crypto.randomBytes(32).toString('hex');
    const inviteTokenExpiry = new Date(Date.now() + INVITE_TOKEN_TTL_MS);

    const user = await this.repo.createBootstrapAdmin({
      username,
      email,
      inviteTokenHash: hashInviteToken(rawInviteToken),
      inviteTokenExpiry,
    });

    return {
      message: 'Tạo tài khoản quản trị đầu tiên thành công.',
      user: { id: user.id, username: user.username, email: user.email, role: user.role },
      inviteToken: rawInviteToken,
      inviteTokenExpiresAt: inviteTokenExpiry.toISOString(),
      flow: ['invite-login', 'register-face', 'verify-wallet', 'generate-secret', 'wallet-login', 'verify-face'],
    };
  }
}

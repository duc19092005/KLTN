import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { AUTH_REPOSITORY, AuthRepositoryPort } from '../ports/auth.repository.port';
import { FACE_CHALLENGE_TTL_MS } from '../../domain/auth.constants';
import { assertNotFaceLocked } from '../../domain/face.util';

@Injectable()
export class FaceLoginChallengeUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repo: AuthRepositoryPort,
  ) {}

  async execute(usernameOrEmail: string) {
    const identity = usernameOrEmail.trim();
    const user = await this.repo.findUserByIdentity(identity, identity.toLowerCase());

    if (!user || user.role === 'ADMIN') {
      throw new UnauthorizedException('Tài khoản không hợp lệ hoặc không có quyền đăng nhập bằng FaceID.');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Tài khoản chưa được kích hoạt hoặc đã bị khóa.');
    }

    if (!user.faceEmbedding) {
      throw new UnauthorizedException('Tài khoản chưa đăng ký sinh trắc học khuôn mặt.');
    }

    assertNotFaceLocked(user);

    const challenge = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + FACE_CHALLENGE_TTL_MS);

    await this.repo.setFaceChallenge(user.id, challenge, expiresAt);

    return {
      challenge,
      userId: user.id,
      expiresAt: expiresAt.toISOString(),
      ttlMs: FACE_CHALLENGE_TTL_MS,
    };
  }
}

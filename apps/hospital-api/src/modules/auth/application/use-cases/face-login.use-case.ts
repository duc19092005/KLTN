import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { AUTH_REPOSITORY, AuthRepositoryPort } from '../ports/auth.repository.port';
import { ACCESS_TOKEN_SIGNER, AccessTokenSignerPort } from '../ports/access-token-signer.port';
import { SECURITY_EVENT_LOGGER, SecurityEventLoggerPort } from '../ports/security-event-logger.port';
import { FaceMatchService } from '../services/face-match.service';
import { assertNotFaceLocked, validateFaceDescriptor } from '../../domain/face.util';
import { toPublicUser } from '../../domain/public-user';

@Injectable()
export class FaceLoginUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repo: AuthRepositoryPort,
    @Inject(ACCESS_TOKEN_SIGNER) private readonly tokenSigner: AccessTokenSignerPort,
    @Inject(SECURITY_EVENT_LOGGER) private readonly audit: SecurityEventLoggerPort,
    private readonly faceMatch: FaceMatchService,
  ) {}

  async execute(userId: string, embedding: number[], challenge: string, ip?: string) {
    const descriptor = validateFaceDescriptor(embedding);
    const user = await this.repo.findUserWithProfile(userId);

    if (!user || user.role === 'ADMIN') {
      throw new UnauthorizedException('Yêu cầu không hợp lệ.');
    }
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Tài khoản chưa được kích hoạt hoặc đã bị khóa.');
    }
    if (!user.faceEmbedding) {
      throw new UnauthorizedException('Tài khoản chưa đăng ký dữ liệu khuôn mặt.');
    }

    assertNotFaceLocked(user);

    // Consume challenge
    const consumed = await this.repo.consumeFaceChallenge(userId, challenge, new Date());
    if (consumed !== 1) {
      throw new UnauthorizedException('Yêu cầu xác thực khuôn mặt không hợp lệ hoặc đã hết hạn.');
    }

    const storedDescriptors = this.faceMatch.decodeStoredDescriptors(user.faceEmbedding);

    // Integrity check
    const integrity = await this.faceMatch.checkIntegrity(userId, storedDescriptors);
    if (!integrity.ok) {
      await this.audit.write(userId, 'FACE_INTEGRITY_FAIL_LOGIN', 'User', userId, {
        recomputedFaceHash: integrity.recomputedFaceHash,
        onChainFaceHash: integrity.onChainFaceHash,
        ip,
      });
      throw new UnauthorizedException('Dữ liệu khuôn mặt đã bị thay đổi. Vui lòng liên hệ quản trị viên.');
    }

    const match = this.faceMatch.computeMatch(descriptor, storedDescriptors);

    console.log(
      `[FaceLoginVerify] userId=${userId} min=${match.distance.toFixed(4)} mean=${match.meanDistance.toFixed(4)} threshold=${match.threshold} result=${match.passed ? 'PASS' : 'FAIL'}`,
    );

    if (!match.passed) {
      const lockInfo = await this.faceMatch.recordFailure(user);
      await this.audit.write(userId, 'FACE_VERIFY_FAIL_LOGIN', 'User', userId, {
        minDistance: Number(match.distance.toFixed(4)),
        meanDistance: Number(match.meanDistance.toFixed(4)),
        threshold: match.threshold,
        failedAttempts: lockInfo.failedAttempts,
        locked: lockInfo.locked,
        ip,
      });
      if (lockInfo.locked) {
        throw new UnauthorizedException('Thử sai quá nhiều lần. Tài khoản tạm thời bị khóa.');
      }
      throw new UnauthorizedException('Xác thực khuôn mặt thất bại.');
    }

    await this.faceMatch.resetFailures(userId);
    await this.audit.write(userId, 'FACE_VERIFY_PASS_LOGIN', 'User', userId, {
      minDistance: Number(match.distance.toFixed(4)),
      meanDistance: Number(match.meanDistance.toFixed(4)),
      threshold: match.threshold,
      ip,
    });

    return {
      access_token: this.tokenSigner.sign(user, { verified: true }),
      verified: true,
      user: toPublicUser(user, true),
    };
  }
}

import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AUTH_REPOSITORY, AuthRepositoryPort } from '../ports/auth.repository.port';
import { SECURITY_EVENT_LOGGER, SecurityEventLoggerPort } from '../ports/security-event-logger.port';
import { FaceMatchService } from '../services/face-match.service';
import { assertNotFaceLocked, validateFaceDescriptor } from '../../domain/face.util';

@Injectable()
export class ForgotPasswordVerifyFaceUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repo: AuthRepositoryPort,
    @Inject(SECURITY_EVENT_LOGGER) private readonly audit: SecurityEventLoggerPort,
    private readonly faceMatch: FaceMatchService,
    private readonly jwtService: JwtService,
  ) {}

  async execute(userId: string, embedding: number[], challenge: string, ip?: string) {
    const descriptor = validateFaceDescriptor(embedding);
    const user = await this.repo.findUserWithProfile(userId);

    if (!user) {
      throw new UnauthorizedException('Không tìm thấy tài khoản.');
    }

    if (!user.faceEmbedding) {
      throw new UnauthorizedException('Tài khoản chưa đăng ký sinh trắc học khuôn mặt.');
    }

    assertNotFaceLocked(user);

    // Consume the challenge atomically
    const consumed = await this.repo.consumeFaceChallenge(userId, challenge, new Date());
    if (consumed !== 1) {
      throw new UnauthorizedException('Yêu cầu xác thực khuôn mặt đã hết hạn hoặc không hợp lệ.');
    }

    const storedDescriptors = this.faceMatch.decodeStoredDescriptors(user.faceEmbedding);

    // Integrity gate
    const integrity = await this.faceMatch.checkIntegrity(userId, storedDescriptors);
    if (!integrity.ok) {
      await this.audit.write(userId, 'FACE_INTEGRITY_FAIL_FORGOT', 'User', userId, {
        recomputedFaceHash: integrity.recomputedFaceHash,
        onChainFaceHash: integrity.onChainFaceHash,
        ip,
      });
      throw new UnauthorizedException('Dữ liệu khuôn mặt đã bị thay đổi. Vui lòng liên hệ quản trị viên.');
    }

    const match = this.faceMatch.computeMatch(descriptor, storedDescriptors);

    console.log(
      `[ForgotPasswordFaceVerify] userId=${userId} min=${match.distance.toFixed(4)} mean=${match.meanDistance.toFixed(4)} threshold=${match.threshold} result=${match.passed ? 'PASS' : 'FAIL'}`,
    );

    if (!match.passed) {
      const lockInfo = await this.faceMatch.recordFailure(user);
      await this.audit.write(userId, 'FACE_VERIFY_FAIL_FORGOT', 'User', userId, {
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
    await this.audit.write(userId, 'FACE_VERIFY_PASS_FORGOT', 'User', userId, {
      minDistance: Number(match.distance.toFixed(4)),
      meanDistance: Number(match.meanDistance.toFixed(4)),
      threshold: match.threshold,
      ip,
    });

    // Create a secure short-lived reset token
    const resetToken = this.jwtService.sign(
      {
        sub: user.id,
        purpose: 'reset-password',
      },
      {
        expiresIn: '5m', // Expires in 5 minutes
      },
    );

    return {
      success: true,
      resetToken,
    };
  }
}

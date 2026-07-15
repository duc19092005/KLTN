import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { AUTH_REPOSITORY, AuthRepositoryPort } from '../ports/auth.repository.port';
import { STEPUP_TICKET_ISSUER, StepUpTicketIssuerPort } from '../ports/stepup-ticket-issuer.port';
import { SECURITY_EVENT_LOGGER, SecurityEventLoggerPort } from '../ports/security-event-logger.port';
import { AuthUserLookupService } from '../services/auth-user-lookup.service';
import { FaceMatchService } from '../services/face-match.service';
import { assertNotFaceLocked, validateFaceDescriptor } from '../../domain/face.util';

/**
 * Step-up (re-authentication) face check for a highly sensitive action. Runs the SAME biometric
 * match + on-chain integrity gate as verifyFace, but does NOT issue a session token. Instead, on
 * success it mints a single-use, action-scoped step-up ticket that the client replays on the
 * protected request. Applies to ALL roles. Behavior copied verbatim from the former
 * AuthService.verifyFaceForStepUp().
 */
@Injectable()
export class VerifyFaceForStepUpUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repo: AuthRepositoryPort,
    @Inject(STEPUP_TICKET_ISSUER) private readonly stepUp: StepUpTicketIssuerPort,
    @Inject(SECURITY_EVENT_LOGGER) private readonly audit: SecurityEventLoggerPort,
    private readonly lookup: AuthUserLookupService,
    private readonly faceMatch: FaceMatchService,
  ) {}

  async execute(
    userId: string,
    embedding: number[],
    challenge: string,
    action: string,
    resourceId?: string | null,
    ip?: string,
  ) {
    const descriptor = validateFaceDescriptor(embedding);
    const user = await this.lookup.getAuthUser(userId);

    if (user.status !== 'ACTIVE' || user.firstLogin) {
      throw new UnauthorizedException('Tài khoản chưa hoàn tất thiết lập');
    }
    if (!user.faceEmbedding) {
      throw new UnauthorizedException('Chưa đăng ký dữ liệu khuôn mặt');
    }

    assertNotFaceLocked(user);

    // Single-use challenge (anti-replay) consumed before matching.
    const consumed = await this.repo.consumeFaceChallenge(userId, challenge, new Date());
    if (consumed !== 1) throw new UnauthorizedException('Yêu cầu xác thực khuôn mặt không hợp lệ hoặc đã hết hạn.');

    const storedDescriptors = this.faceMatch.decodeStoredDescriptors(user.faceEmbedding);

    // Integrity gate: stored template hash must still match the on-chain anchor (if anchored).
    const integrity = await this.faceMatch.checkIntegrity(userId, storedDescriptors);
    if (!integrity.ok) {
      await this.audit.write(userId, 'FACE_INTEGRITY_FAIL', 'User', userId, {
        context: 'STEPUP',
        action,
        resourceId: resourceId ?? null,
        ip,
      });
      throw new UnauthorizedException('Dữ liệu khuôn mặt đã bị thay đổi. Vui lòng liên hệ quản trị viên.');
    }

    const match = this.faceMatch.computeMatch(descriptor, storedDescriptors);

    if (!match.passed) {
      const lockInfo = await this.faceMatch.recordFailure(user);
      await this.audit.write(userId, 'FACE_VERIFY_FAIL', 'User', userId, {
        context: 'STEPUP',
        action,
        resourceId: resourceId ?? null,
        minDistance: Number(match.distance.toFixed(4)),
        threshold: match.threshold,
        failedAttempts: lockInfo.failedAttempts,
        locked: lockInfo.locked,
        ip,
      });
      if (lockInfo.locked) {
        throw new UnauthorizedException('Quá nhiều lần thử khuôn mặt thất bại. Tài khoản tạm khóa.');
      }
      throw new UnauthorizedException('Xác thực khuôn mặt thất bại');
    }

    await this.faceMatch.resetFailures(userId);

    // Mint the single-use ticket; this is what authorizes the sensitive action.
    const ticket = await this.stepUp.issue(userId, action, resourceId ?? null, ip);

    await this.audit.write(userId, 'FACE_STEPUP_PASS', 'User', userId, {
      action,
      resourceId: resourceId ?? null,
      minDistance: Number(match.distance.toFixed(4)),
      threshold: match.threshold,
      ip,
    });

    return ticket;
  }
}

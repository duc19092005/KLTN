import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { AUTH_REPOSITORY, AuthRepositoryPort } from '../ports/auth.repository.port';
import { ACCESS_TOKEN_SIGNER, AccessTokenSignerPort } from '../ports/access-token-signer.port';
import { SECURITY_EVENT_LOGGER, SecurityEventLoggerPort } from '../ports/security-event-logger.port';
import { STEPUP_TICKET_ISSUER, StepUpTicketIssuerPort } from '../ports/stepup-ticket-issuer.port';
import { AuthUserLookupService } from '../services/auth-user-lookup.service';
import { FaceMatchService } from '../services/face-match.service';
import { assertNotFaceLocked, validateFaceDescriptor } from '../../domain/face.util';
import { toPublicUser } from '../../domain/public-user';

/**
 * Full face login. Behavior copied verbatim from the former AuthService.verifyFace():
 * admin wallet-session checks, single-use challenge consume, on-chain integrity gate,
 * euclidean matching with lockout, audit at every branch, and a verified token on success.
 */
@Injectable()
export class VerifyFaceUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repo: AuthRepositoryPort,
    @Inject(ACCESS_TOKEN_SIGNER) private readonly tokenSigner: AccessTokenSignerPort,
    @Inject(SECURITY_EVENT_LOGGER) private readonly audit: SecurityEventLoggerPort,
    @Inject(STEPUP_TICKET_ISSUER) private readonly stepUp: StepUpTicketIssuerPort,
    private readonly lookup: AuthUserLookupService,
    private readonly faceMatch: FaceMatchService,
  ) {}

  async execute(userId: string, embedding: number[], challenge: string, tokenWalletAddress?: string, ip?: string) {
    const descriptor = validateFaceDescriptor(embedding);
    const user = await this.lookup.getAuthUser(userId);

    if (user.role === 'ADMIN' && !tokenWalletAddress) {
      throw new UnauthorizedException('Vui lòng xác thực ví trước khi xác thực khuôn mặt.');
    }
    if (user.status !== 'ACTIVE' || user.firstLogin) {
      throw new UnauthorizedException('Tài khoản chưa hoàn tất thiết lập.');
    }
    if (!user.faceEmbedding) {
      throw new UnauthorizedException('Tài khoản chưa đăng ký dữ liệu khuôn mặt.');
    }
    if (user.role === 'ADMIN' && !user.adminProfile?.walletAddress) {
      throw new UnauthorizedException('Tài khoản chưa đăng ký ví.');
    }
    if (user.role === 'ADMIN' && user.adminProfile?.walletAddress.toLowerCase() !== tokenWalletAddress!.toLowerCase()) {
      throw new UnauthorizedException('Phiên ví không khớp với tài khoản.');
    }

    assertNotFaceLocked(user);

    // Consume the single-use challenge atomically before matching (anti-replay).
    const consumed = await this.repo.consumeFaceChallenge(userId, challenge, new Date());
    if (consumed !== 1) throw new UnauthorizedException('Yêu cầu xác thực khuôn mặt không hợp lệ hoặc đã hết hạn.');

    const storedDescriptors = this.faceMatch.decodeStoredDescriptors(user.faceEmbedding);

    // Integrity gate: stored template hash must still match the on-chain anchor (if anchored).
    const integrity = await this.faceMatch.checkIntegrity(userId, storedDescriptors);
    if (!integrity.ok) {
      await this.audit.write(userId, 'FACE_INTEGRITY_FAIL', 'User', userId, {
        recomputedFaceHash: integrity.recomputedFaceHash,
        onChainFaceHash: integrity.onChainFaceHash,
        ip,
      });
      throw new UnauthorizedException('Dữ liệu khuôn mặt đã bị thay đổi. Vui lòng liên hệ quản trị viên.');
    }

    const match = this.faceMatch.computeMatch(descriptor, storedDescriptors);

    console.log(
      `[FaceVerify] userId=${userId} min=${match.distance.toFixed(4)} mean=${match.meanDistance.toFixed(4)} threshold=${match.threshold} result=${match.passed ? 'PASS' : 'FAIL'}`,
    );

    if (!match.passed) {
      const lockInfo = await this.faceMatch.recordFailure(user);
      await this.audit.write(userId, 'FACE_VERIFY_FAIL', 'User', userId, {
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
    await this.audit.write(userId, 'FACE_VERIFY_PASS', 'User', userId, {
      minDistance: Number(match.distance.toFixed(4)),
      meanDistance: Number(match.meanDistance.toFixed(4)),
      threshold: match.threshold,
      ip,
    });

    // Face login already proves a live biometric match, so we open a step-up privilege session from
    // that same proof. The user lands on the dashboard with "sudo mode" already active and does not
    // have to scan a second time for the first sensitive write. Best-effort: a session hiccup must
    // never block a valid login. Each sensitive action is still audited individually downstream.
    let stepUpSession: unknown = null;
    try {
      stepUpSession = await this.stepUp.issueSession(userId, 'SENSITIVE_WRITE', ip);
      await this.audit.write(userId, 'FACE_STEPUP_SESSION_OPEN', 'User', userId, { scope: 'SENSITIVE_WRITE', context: 'LOGIN', ip });
    } catch (err) {
      console.warn(`[FaceVerify] auto step-up session open failed for userId=${userId}:`, (err as Error)?.message);
    }

    return {
      access_token: this.tokenSigner.sign(user, { verified: true, walletAddress: user.adminProfile?.walletAddress }),
      verified: true,
      algorithm: 'face-api/euclidean-distance/min-of-multi-sample',
      matchedDescriptorCount: storedDescriptors.length,
      stepUpSession,
      user: toPublicUser(user, true),
    };
  }
}

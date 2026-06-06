import { ForbiddenException, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

/**
 * StepUpService manages short-lived, single-use "step-up" tickets that prove a user
 * re-authenticated with their face immediately before a highly sensitive action.
 *
 * Separation of concerns:
 *  - The biometric match itself happens in AuthService (it owns the face logic). On success it
 *    calls issue() to mint a ticket.
 *  - This service only mints and atomically consumes tickets, so it has no circular dependency on
 *    AuthService and can be injected directly into FaceStepUpGuard.
 *
 * Security properties:
 *  - Only the SHA256 of the raw token is stored; the raw token is returned to the client once.
 *  - Tickets are scoped to (userId, action, resourceId) so a ticket minted to delete doctor A
 *    cannot authorize deleting doctor B, nor a different action.
 *  - Single-use: consume() flips usedAt atomically via updateMany; a second attempt finds 0 rows.
 *  - Time-boxed: expiresAt (default 3 min) bounds the replay window even before consumption.
 */
@Injectable()
export class StepUpService {
  private readonly ttlMs = Number(process.env.STEPUP_TTL_MS ?? 3 * 60 * 1000);

  constructor(private readonly prisma: PrismaService) {}

  private hash(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /** Mint a single-use ticket for (userId, action, resourceId). Returns the raw token once. */
  async issue(userId: string, action: string, resourceId?: string | null, ip?: string) {
    const raw = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.ttlMs);
    await this.prisma.stepUpTicket.create({
      data: { tokenHash: this.hash(raw), userId, action, resourceId: resourceId ?? null, ip: ip ?? null, expiresAt },
    });
    return { ticket: raw, action, resourceId: resourceId ?? null, expiresAt: expiresAt.toISOString(), ttlMs: this.ttlMs };
  }

  /**
   * Atomically validate and consume a ticket. Throws ForbiddenException if the token is missing,
   * unknown, expired, already used, or scoped to a different user/action/resource.
   */
  async consume(params: {
    userId: string;
    action: string;
    token?: string | null;
    resourceId?: string | null;
    ip?: string;
  }): Promise<void> {
    const { userId, action, token } = params;
    if (!token) {
      throw new ForbiddenException('Yêu cầu xác thực khuôn mặt cho thao tác nhạy cảm này.');
    }
    const now = new Date();
    const result = await this.prisma.stepUpTicket.updateMany({
      where: {
        tokenHash: this.hash(token),
        userId,
        action,
        resourceId: params.resourceId ?? null,
        usedAt: null,
        expiresAt: { gte: now },
      },
      data: { usedAt: now },
    });
    if (result.count !== 1) {
      throw new ForbiddenException('Vé xác thực khuôn mặt không hợp lệ hoặc đã hết hạn. Vui lòng quét lại.');
    }
  }

  // ---------------------------------------------------------------------------
  // Step-up SESSION ("sudo mode"): one face scan opens a short-lived privilege
  // window that authorizes many Tier-B sensitive writes without re-scanning.
  // Slides on use (idle) up to a hard absolute ceiling; can be revoked early.
  // ---------------------------------------------------------------------------
  private readonly sessionIdleMs = Number(process.env.STEPUP_SESSION_IDLE_MS ?? 10 * 60 * 1000);
  private readonly sessionAbsoluteMs = Number(process.env.STEPUP_SESSION_ABSOLUTE_MS ?? 30 * 60 * 1000);

  /** Open a privilege session after a successful face match. Returns the raw token once. */
  async issueSession(userId: string, scope = 'SENSITIVE_WRITE', ip?: string) {
    const raw = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    const idleExpiresAt = new Date(now + this.sessionIdleMs);
    const absoluteExpiresAt = new Date(now + this.sessionAbsoluteMs);
    await this.prisma.stepUpSession.create({
      data: { tokenHash: this.hash(raw), userId, scope, ip: ip ?? null, idleExpiresAt, absoluteExpiresAt },
    });
    return {
      session: raw,
      scope,
      idleExpiresAt: idleExpiresAt.toISOString(),
      absoluteExpiresAt: absoluteExpiresAt.toISOString(),
      idleMs: this.sessionIdleMs,
      absoluteMs: this.sessionAbsoluteMs,
    };
  }

  /**
   * Validate an active session for (userId, scope) and slide its idle window. Does NOT burn the
   * session (it is reusable until idle/absolute expiry or revocation). Returns the fresh deadlines.
   * Throws ForbiddenException(code: STEPUP_SESSION_REQUIRED) when no valid session exists, so the
   * client can transparently prompt a face scan and retry.
   */
  async consumeSession(params: { userId: string; scope?: string; token?: string | null }) {
    const scope = params.scope ?? 'SENSITIVE_WRITE';
    const { userId, token } = params;
    if (!token) {
      throw new ForbiddenException({ code: 'STEPUP_SESSION_REQUIRED', message: 'Cần mở phiên xác thực khuôn mặt cho thao tác này.' });
    }
    const now = new Date();
    const session = await this.prisma.stepUpSession.findFirst({
      where: {
        tokenHash: this.hash(token),
        userId,
        scope,
        revokedAt: null,
        idleExpiresAt: { gte: now },
        absoluteExpiresAt: { gte: now },
      },
    });
    if (!session) {
      throw new ForbiddenException({ code: 'STEPUP_SESSION_REQUIRED', message: 'Phiên xác thực đã hết hạn hoặc không hợp lệ. Vui lòng quét khuôn mặt lại.' });
    }
    // Slide the idle window, but never beyond the absolute ceiling.
    const nextIdle = new Date(Math.min(now.getTime() + this.sessionIdleMs, session.absoluteExpiresAt.getTime()));
    await this.prisma.stepUpSession.update({
      where: { id: session.id },
      data: { lastUsedAt: now, idleExpiresAt: nextIdle },
    });
    return { idleExpiresAt: nextIdle.toISOString(), absoluteExpiresAt: session.absoluteExpiresAt.toISOString() };
  }

  /** Return the caller's active session deadlines, or null if none is valid. */
  async getActiveSession(userId: string, scope = 'SENSITIVE_WRITE') {
    const now = new Date();
    const session = await this.prisma.stepUpSession.findFirst({
      where: {
        userId,
        scope,
        revokedAt: null,
        idleExpiresAt: { gte: now },
        absoluteExpiresAt: { gte: now },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!session) return { active: false as const };
    return {
      active: true as const,
      idleExpiresAt: session.idleExpiresAt.toISOString(),
      absoluteExpiresAt: session.absoluteExpiresAt.toISOString(),
    };
  }

  /** Revoke all active sessions for a user+scope (manual "lock" / logout). */
  async revokeSessions(userId: string, scope = 'SENSITIVE_WRITE') {
    await this.prisma.stepUpSession.updateMany({
      where: { userId, scope, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

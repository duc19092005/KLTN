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
}

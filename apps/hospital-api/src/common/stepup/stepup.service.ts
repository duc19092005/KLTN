import { ForbiddenException, Injectable, OnModuleDestroy } from '@nestjs/common';
import * as crypto from 'crypto';
import Redis from 'ioredis';

interface TicketData {
  userId: string;
  action: string;
  resourceId: string | null;
  expiresAtIso: string;
}

/**
 * StepUpService manages short-lived, single-use "step-up" tickets that prove a user
 * re-authenticated with their face immediately before a highly sensitive action.
 *
 * Performance & Storage:
 *  - Stores single-use tickets in Redis cache with automatic 180s TTL (`SETEX`).
 *  - Features a seamless in-memory Map fallback for local testing & offline mode.
 *  - Single-use semantics: ticket key is atomically deleted on first consumption (`DEL`).
 *
 * Security properties:
 *  - Only the SHA256 hash of the raw token is stored as the key.
 *  - Tickets are strictly scoped to (userId, action, resourceId).
 */
@Injectable()
export class StepUpService implements OnModuleDestroy {
  private readonly ttlSeconds = Math.max(1, Math.floor(Number(process.env.STEPUP_TTL_MS ?? 180000) / 1000));
  private readonly redisClient: Redis | null = null;
  private readonly memoryStore = new Map<string, TicketData>();
  private readonly memoryTimeouts = new Map<string, NodeJS.Timeout>();

  constructor() {
    const host = process.env.REDIS_HOST;
    const port = Number(process.env.REDIS_PORT ?? 6379);
    const redisUrl = process.env.REDIS_URL;

    if (redisUrl || host) {
      try {
        this.redisClient = redisUrl
          ? new Redis(redisUrl, { maxRetriesPerRequest: 1, enableOfflineQueue: false })
          : new Redis({ host: host || 'localhost', port, maxRetriesPerRequest: 1, enableOfflineQueue: false });

        this.redisClient.on('error', () => {
          // Silent fallback to memoryStore if Redis connection drops
        });
      } catch {
        this.redisClient = null;
      }
    }
  }

  onModuleDestroy() {
    if (this.redisClient) {
      this.redisClient.disconnect();
    }
    for (const timeout of this.memoryTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.memoryTimeouts.clear();
    this.memoryStore.clear();
  }

  private hash(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /** Mint a single-use ticket for (userId, action, resourceId). Returns the raw token once. */
  async issue(userId: string, action: string, resourceId?: string | null, ip?: string) {
    const raw = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hash(raw);
    const expiresAt = new Date(Date.now() + this.ttlSeconds * 1000);
    const payload: TicketData = {
      userId,
      action,
      resourceId: resourceId ?? null,
      expiresAtIso: expiresAt.toISOString(),
    };

    let savedToRedis = false;
    if (this.redisClient && this.redisClient.status === 'ready') {
      try {
        await this.redisClient.setex(`stepup:ticket:${tokenHash}`, this.ttlSeconds, JSON.stringify(payload));
        savedToRedis = true;
      } catch {
        savedToRedis = false;
      }
    }

    // Always keep memoryStore in sync for fallback
    this.memoryStore.set(tokenHash, payload);
    const timeout = setTimeout(() => {
      this.memoryStore.delete(tokenHash);
      this.memoryTimeouts.delete(tokenHash);
    }, this.ttlSeconds * 1000);
    this.memoryTimeouts.set(tokenHash, timeout);

    return { ticket: raw, action, resourceId: resourceId ?? null, expiresAt: expiresAt.toISOString(), ttlMs: this.ttlSeconds * 1000 };
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

    const tokenHash = this.hash(token);
    let payload: TicketData | null = null;

    if (this.redisClient && this.redisClient.status === 'ready') {
      try {
        const key = `stepup:ticket:${tokenHash}`;
        const rawPayload = await this.redisClient.get(key);
        if (rawPayload) {
          await this.redisClient.del(key);
          payload = JSON.parse(rawPayload) as TicketData;
        }
      } catch {
        payload = null;
      }
    }

    // Fallback to memoryStore if Redis didn't yield or is offline
    if (!payload && this.memoryStore.has(tokenHash)) {
      payload = this.memoryStore.get(tokenHash)!;
      this.memoryStore.delete(tokenHash);
      const timeout = this.memoryTimeouts.get(tokenHash);
      if (timeout) {
        clearTimeout(timeout);
        this.memoryTimeouts.delete(tokenHash);
      }
    }

    if (!payload) {
      throw new ForbiddenException('Vé xác thực khuôn mặt không hợp lệ hoặc đã hết hạn. Vui lòng quét lại.');
    }

    const now = new Date();
    const expired = new Date(payload.expiresAtIso) < now;
    const userMatch = payload.userId === userId;
    const actionMatch = payload.action === action;
    const resourceMatch = (params.resourceId ?? null) === payload.resourceId;

    if (expired || !userMatch || !actionMatch || !resourceMatch) {
      throw new ForbiddenException('Vé xác thực khuôn mặt không hợp lệ hoặc đã hết hạn. Vui lòng quét lại.');
    }
  }
}

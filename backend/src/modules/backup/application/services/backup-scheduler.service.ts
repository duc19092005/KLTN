import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CreateBackupUseCase } from '../use-cases/create-backup.use-case';

/**
 * Daily automatic backup scheduler.
 *
 * Runs CreateBackupUseCase once per day at a configured hour (default 02:00 local time — a
 * low-traffic window). This is a SYSTEM-initiated job: it passes no actorId, so the resulting
 * BlockchainLogger/BackupRecord is attributed to the system, and it does NOT require a face
 * step-up (step-up only guards human-initiated HTTP actions).
 *
 * Why setTimeout instead of @nestjs/schedule: the codebase already schedules with plain timers
 * (see AuditAnchorService). We keep that convention to avoid adding a dependency.
 *
 * Env:
 *   BACKUP_CRON_ENABLED  'true' (default) | 'false' — master switch.
 *   BACKUP_CRON_HOUR     hour of day 0-23 (default 2). Minute is fixed at :00.
 */
@Injectable()
export class BackupSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BackupSchedulerService.name);
  private timer: NodeJS.Timeout | null = null;
  private readonly enabled = (process.env.BACKUP_CRON_ENABLED ?? 'true') !== 'false';
  private readonly hour = this.parseHour(process.env.BACKUP_CRON_HOUR);

  constructor(private readonly createBackup: CreateBackupUseCase) {}

  onModuleInit() {
    if (!this.enabled) {
      this.logger.warn('Automatic daily backup disabled via BACKUP_CRON_ENABLED=false.');
      return;
    }
    this.scheduleNext();
  }

  onModuleDestroy() {
    if (this.timer) clearTimeout(this.timer);
  }

  /** Arm a one-shot timer for the next occurrence of HH:00, then re-arm after it fires. */
  private scheduleNext() {
    const delay = this.msUntilNextRun();
    const runAt = new Date(Date.now() + delay);
    this.timer = setTimeout(() => {
      this.runBackup()
        .catch((err) => this.logger.error('Scheduled backup failed', err as any))
        .finally(() => this.scheduleNext()); // re-arm for the following day regardless of outcome
    }, delay);
    // Don't let the timer keep the event loop alive during shutdown.
    this.timer.unref?.();
    this.logger.log(`Automatic daily backup scheduled for ${runAt.toLocaleString('vi-VN')} (every 24h at ${String(this.hour).padStart(2, '0')}:00).`);
  }

  private async runBackup() {
    this.logger.log('🗄️  [Scheduled Backup] Starting automatic daily backup...');
    const res = await this.createBackup.execute(); // no actorId -> system-initiated
    this.logger.log(`✅ [Scheduled Backup] ${res.backupCode} created (anchored=${res.anchored}, maxSeq=${res.maxSeq}).`);
  }

  /** Milliseconds from now until the next HH:00. Always returns a positive value. */
  private msUntilNextRun(): number {
    const now = new Date();
    const next = new Date(now);
    next.setHours(this.hour, 0, 0, 0);
    if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
    return next.getTime() - now.getTime();
  }

  private parseHour(raw?: string): number {
    const h = Number(raw);
    return Number.isInteger(h) && h >= 0 && h <= 23 ? h : 2;
  }
}

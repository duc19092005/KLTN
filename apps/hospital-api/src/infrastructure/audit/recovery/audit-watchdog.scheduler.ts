import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { WatchdogState } from './deep-scan-state';
import { AuditBatchScanner } from './audit-batch-scanner';
import { AuditBatchRestorer } from './audit-batch-restorer';

@Injectable()
export class AuditWatchdogScheduler implements OnModuleInit, OnModuleDestroy {
  private watchdogTimer: NodeJS.Timeout | null = null;
  private watchdogState: WatchdogState = {
    enabled: true,
    intervalMinutes: 20,
    chunkSize: 15,
    lastRunAt: null,
    nextRunAt: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
    lastScannedBatches: 0,
    lastHealedBatches: 0,
    lastErrors: [],
    statusMessage: 'Tự động chạy ngầm mỗi 20 phút (phân đoạn 15 lô / lượt).',
  };

  constructor(
    private readonly blockchain: BlockchainService,
    private readonly scanner: AuditBatchScanner,
    private readonly restorer: AuditBatchRestorer,
  ) {}

  onModuleInit() {
    const intervalMs = 20 * 60 * 1000;
    this.watchdogTimer = setInterval(() => {
      void this.runWatchdogAutoHealSweep().catch((err) => {
        console.error('[WATCHDOG AUTO-HEAL ERROR]', err);
      });
    }, intervalMs);

    setTimeout(() => {
      void this.runWatchdogAutoHealSweep().catch(() => {});
    }, 15000);
  }

  onModuleDestroy() {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
    }
  }

  getWatchdogStatus(): WatchdogState {
    return this.watchdogState;
  }

  async runWatchdogAutoHealSweep(isDeepScanActive?: () => boolean): Promise<{ scanned: number; healed: number }> {
    if (isDeepScanActive && isDeepScanActive()) {
      return { scanned: 0, healed: 0 };
    }

    const now = new Date();
    this.watchdogState.lastRunAt = now.toISOString();
    this.watchdogState.nextRunAt = new Date(now.getTime() + 20 * 60 * 1000).toISOString();

    let totalScanned = 0;
    let totalHealed = 0;
    const errors: string[] = [];

    try {
      const latestOnChain = await this.blockchain.getLatestAuditBatchId();
      if (!latestOnChain || latestOnChain <= 0) {
        this.watchdogState.statusMessage = 'Chưa có batch nào trên Blockchain.';
        return { scanned: 0, healed: 0 };
      }

      const scanResult = await this.scanner.scanCheckpointsAgainstLocalDb(1, latestOnChain);
      totalScanned = scanResult.scannedCount;

      for (const bId of scanResult.targetBatchIds) {
        try {
          await this.restorer.recoverBatchDirectFromChain(bId, null, 'Automated 20-minute Background Watchdog Auto-Healing');
          totalHealed += 1;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          errors.push(`Batch #${bId}: ${message}`);
          console.error(`[WATCHDOG] Failed to auto-heal batch #${bId}:`, err);
        }
      }

      this.watchdogState.lastScannedBatches = totalScanned;
      this.watchdogState.lastHealedBatches = totalHealed;
      this.watchdogState.lastErrors = errors;
      this.watchdogState.statusMessage = errors.length > 0
        ? `[WATCHDOG 20m] Khôi phục chưa hoàn tất: ${errors.length} lô lỗi, ${totalHealed} lô đã phục hồi.`
        : totalHealed > 0
          ? `[WATCHDOG 20m] Đã tự động phát hiện và khôi phục thành công ${totalHealed} lô bị sai lệch!`
          : `[WATCHDOG 20m] Tất cả ${totalScanned} lô trên Blockchain và DB local đều toàn vẹn 100%.`;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(message);
      this.watchdogState.lastErrors = errors;
      this.watchdogState.statusMessage = `[WATCHDOG 20m] Quét thất bại: ${message}`;
      console.error('[WATCHDOG SWEEP ERROR]', err);
    }

    return { scanned: totalScanned, healed: totalHealed };
  }
}
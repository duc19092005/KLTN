import { ConflictException, Injectable, Optional } from '@nestjs/common';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { DeepScanProgressState } from './deep-scan-state';
import { EntityRecoveryService } from './entity-recovery.service';
import { AuditBatchScanner } from './audit-batch-scanner';
import { AuditBatchRestorer } from './audit-batch-restorer';

@Injectable()
export class AuditDeepScanService {
  private deepScanState: DeepScanProgressState = {
    active: false,
    progressPercent: 0,
    statusMessage: 'Hệ thống sẵn sàng đối soát.',
    logs: [],
    startTime: null,
    endTime: null,
    result: null,
  };

  constructor(
    private readonly blockchain: BlockchainService,
    private readonly scanner: AuditBatchScanner,
    private readonly restorer: AuditBatchRestorer,
    @Optional() private readonly entityRecovery?: EntityRecoveryService,
  ) {}

  getDeepScanStatus(): DeepScanProgressState {
    return this.deepScanState;
  }

  isDeepScanActive(): boolean {
    return this.deepScanState.active;
  }

  async startDeepScanAndSelfHeal(adminId: string): Promise<{ message: string; active: boolean }> {
    if (this.deepScanState.active) {
      throw new ConflictException('Tiến trình đối soát và tự động sửa chữa đang chạy.');
    }

    void this.runDeepScanAndSelfHealProcess(adminId).catch((error) => {
      console.error('DEEP SCAN ERROR:', error);
    });

    return {
      message: 'Đã kích hoạt thành công tiến trình đối soát ngầm và tự động sửa chữa Audit Batch.',
      active: true,
    };
  }

  private timeLog(): string {
    const now = new Date();
    return `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}]`;
  }

  private pushLog(msg: string) {
    const entry = `${this.timeLog()} ${msg}`;
    this.deepScanState.logs.push(entry);
    if (this.deepScanState.logs.length > 200) {
      this.deepScanState.logs.shift();
    }
  }

  private async runDeepScanAndSelfHealProcess(adminId: string) {
    this.deepScanState = {
      active: true,
      progressPercent: 5,
      statusMessage: 'Đã xác thực Admin. Đang kết nối Blockchain...',
      logs: [],
      startTime: new Date().toISOString(),
      endTime: null,
      result: null,
    };

    this.pushLog('👤 Khởi chạy tiến trình đối soát chi tiết...');

    let scannedCount = 0;
    let recoveredBatchesCount = 0;
    let recoveredEntitiesCount = 0;
    const errors: string[] = [];

    try {
      this.deepScanState.progressPercent = 10;
      this.pushLog('🔍 [Pass 1] Đang đọc batch mới nhất từ Blockchain...');

      const latestOnChain = await this.blockchain.getLatestAuditBatchId();
      if (!latestOnChain || latestOnChain <= 0) {
        this.pushLog('ℹ️ Chưa có batch nào được ghi nhận trên Blockchain.');
        this.deepScanState.progressPercent = 100;
        this.deepScanState.statusMessage = 'Chưa có batch nào trên Blockchain.';
        this.deepScanState.active = false;
        this.deepScanState.endTime = new Date().toISOString();
        this.deepScanState.result = { scannedBatches: 0, recoveredBatches: 0, recoveredEntities: 0, errors: [] };
        return;
      }

      this.pushLog(`🔗 Blockchain đã ghi nhận tổng cộng ${latestOnChain} Audit Batches (Batch #1 đến #${latestOnChain}).`);
      this.deepScanState.progressPercent = 20;

      const scanResult = await this.scanner.scanCheckpointsAgainstLocalDb(1, latestOnChain);
      scannedCount = scanResult.scannedCount;

      this.pushLog(`📊 Đã quét DB local: Tìm thấy ${scanResult.localBatchesCount}/${scannedCount} batches.`);

      for (const anomaly of scanResult.anomalies) {
        this.pushLog(`⚠️ ${anomaly.reason}`);
      }

      if (scanResult.targetBatchIds.length === 0) {
        this.pushLog('✅ [Pass 1] Tất cả Audit Batches trên DB local đều khớp 100% với Blockchain!');
        this.deepScanState.progressPercent = 60;
      } else {
        this.pushLog(`🔧 [Pass 2] Khởi chạy khôi phục tự động cho ${scanResult.targetBatchIds.length} batch(es)...`);
        
        const totalTargets = scanResult.targetBatchIds.length;
        for (let idx = 0; idx < totalTargets; idx++) {
          const bId = scanResult.targetBatchIds[idx];
          const pct = Math.floor(20 + ((idx + 1) / totalTargets) * 40);
          this.deepScanState.progressPercent = pct;
          this.pushLog(`📥 Đang tải IPFS Artifact cho Batch #${bId} từ Blockchain...`);

          try {
            await this.restorer.recoverBatchDirectFromChain(bId, adminId, 'Deep-Scan Automatic Self-Healing');
            recoveredBatchesCount++;
            this.pushLog(`🟢 Đã tự động phục hồi thành công Batch #${bId} từ IPFS!`);
          } catch (err) {
            const errStr = err instanceof Error ? err.message : String(err);
            errors.push(`Batch #${bId}: ${errStr}`);
            this.pushLog(`❌ Lỗi khi khôi phục Batch #${bId}: ${errStr}`);
          }
        }
      }

      this.deepScanState.progressPercent = 75;
      this.pushLog('🧹 Đang quét kiểm tra các Entity nghiệp vụ bị ảnh hưởng...');

      if (this.entityRecovery) {
        try {
          const warnings = await this.entityRecovery.listWarnings(200);
          const recoverable = warnings.items.filter((w) => w.recoverable);
          if (recoverable.length > 0) {
            this.pushLog(`🔧 [Pass 3] Tự động phục hồi ${recoverable.length} thực thể nghiệp vụ...`);
            const entityRes = await this.entityRecovery.recoverMany(
              recoverable.map((w) => ({ entity: w.entity, entityId: w.entityId })),
              adminId,
              'Deep-Scan Automated Clinical Entity Healing',
            );
            recoveredEntitiesCount = entityRes.recovered;
            this.pushLog(`🟢 Đã tự động phục hồi thành công ${entityRes.recovered} thực thể nghiệp vụ!`);
          } else {
            this.pushLog('✅ Tất cả thực thể nghiệp vụ đều toàn vẹn 100%!');
          }
        } catch (entityErr) {
          const errStr = entityErr instanceof Error ? entityErr.message : String(entityErr);
          errors.push(`Entity recovery: ${errStr}`);
          this.pushLog(`⚠️ Không thể hoàn tất tự động phục hồi entity: ${errStr}`);
        }
      }

      this.deepScanState.progressPercent = 100;
      this.deepScanState.statusMessage = errors.length > 0
        ? `Đối soát hoàn tất một phần: ${errors.length} lỗi cần xử lý.`
        : recoveredBatchesCount > 0
          ? `Đã tự động sửa chữa thành công ${recoveredBatchesCount} audit batch(es).`
          : 'Tất cả Audit Batches đều an toàn và toàn vẹn 100%.';
      this.pushLog(errors.length > 0
        ? `⚠️ Hoàn tất đối soát với ${errors.length} lỗi.`
        : `🎉 Hoàn tất 100%! Đã quét ${scannedCount} batches, tự động sửa chữa ${recoveredBatchesCount} batches.`);

      this.deepScanState.result = {
        scannedBatches: scannedCount,
        recoveredBatches: recoveredBatchesCount,
        recoveredEntities: recoveredEntitiesCount,
        errors,
      };
    } catch (globalErr) {
      const errStr = globalErr instanceof Error ? globalErr.message : String(globalErr);
      errors.push(errStr);
      this.pushLog(`🚨 Tiến trình đối soát gặp lỗi: ${errStr}`);
      this.deepScanState.statusMessage = `Gặp lỗi trong tiến trình đối soát: ${errStr}`;
    } finally {
      this.deepScanState.active = false;
      this.deepScanState.endTime = new Date().toISOString();
    }
  }
}
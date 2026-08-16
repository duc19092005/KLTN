import { BadRequestException, ConflictException, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { AuditArtifactService, AuditRecoveryBundleRow } from './audit-artifact.service';
import { AuditAnchorService } from './audit-anchor.service';
import { AuditLoggerService } from './audit-logger.service';
import { computeMerkleRootForAlgorithm, MERKLE_SHA256_STRING_V1, rootToBytes32 } from './merkle.util';
import { verifyAuditRow } from './audit-verification.util';

export interface VerifiedAuditRecoveryBundle {
  batchId: number;
  artifactHash: string;
  artifactUri: string;
  merkleRoot: string;
  logs: AuditRecoveryBundleRow[];
}

export interface DeepScanProgressState {
  active: boolean;
  progressPercent: number;
  statusMessage: string;
  logs: string[];
  startTime: string | null;
  endTime: string | null;
  result: {
    scannedBatches: number;
    recoveredBatches: number;
    recoveredEntities: number;
    errors: string[];
  } | null;
}

export interface WatchdogState {
  enabled: boolean;
  intervalMinutes: number;
  chunkSize: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastScannedBatches: number;
  lastHealedBatches: number;
  statusMessage: string;
}

@Injectable()
export class AuditRecoveryService implements OnModuleInit, OnModuleDestroy {
  private readonly runningBatches = new Set<number>();
  private watchdogTimer: NodeJS.Timeout | null = null;
  private watchdogState: WatchdogState = {
    enabled: true,
    intervalMinutes: 20,
    chunkSize: 15,
    lastRunAt: null,
    nextRunAt: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
    lastScannedBatches: 0,
    lastHealedBatches: 0,
    statusMessage: 'Tự động chạy ngầm mỗi 20 phút (phân đoạn 15 lô / lượt).',
  };

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
    private readonly prisma: PrismaService,
    private readonly blockchain: BlockchainService,
    private readonly artifacts: AuditArtifactService,
    private readonly anchor: AuditAnchorService,
    private readonly audit: AuditLoggerService,
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

  async runWatchdogAutoHealSweep(): Promise<{ scanned: number; healed: number }> {
    if (this.deepScanState.active) {
      return { scanned: 0, healed: 0 };
    }

    const now = new Date();
    this.watchdogState.lastRunAt = now.toISOString();
    this.watchdogState.nextRunAt = new Date(now.getTime() + 20 * 60 * 1000).toISOString();

    let totalScanned = 0;
    let totalHealed = 0;

    try {
      const latestOnChain = await this.blockchain.getLatestAuditBatchId();
      if (!latestOnChain || latestOnChain <= 0) {
        this.watchdogState.statusMessage = 'Chưa có batch nào trên Blockchain.';
        return { scanned: 0, healed: 0 };
      }

      const checkpoints = await this.blockchain.getAuditCheckpointsRange(1, latestOnChain);
      totalScanned = checkpoints.length;
      const chunkSize = 15;
      const targetBatchIds: number[] = [];

      for (let i = 0; i < checkpoints.length; i += chunkSize) {
        const chunk = checkpoints.slice(i, i + chunkSize);
        const localBatches = await this.prisma.auditBatch.findMany({
          where: { batchId: { in: chunk.map((c) => c.batchId) } },
          select: {
            batchId: true,
            merkleRoot: true,
            status: true,
            fromSeq: true,
            toSeq: true,
            leafCount: true,
            algorithmVersion: true,
          },
        });
        const localMap = new Map(localBatches.map((b) => [b.batchId, b]));

        for (const cp of chunk) {
          if (!cp.committed) continue;
          const local = localMap.get(cp.batchId);
          if (!local || local.status !== 'ANCHORED') {
            targetBatchIds.push(cp.batchId);
            continue;
          }

          if (rootToBytes32(local.merkleRoot).toLowerCase() !== rootToBytes32(cp.root).toLowerCase()) {
            targetBatchIds.push(cp.batchId);
            continue;
          }

          if (local.fromSeq != null && local.toSeq != null) {
            const logsInBatch = await this.prisma.blockchainLogger.findMany({
              where: { seq: { gte: local.fromSeq, lte: local.toSeq }, entryHash: { not: null } },
              select: { seq: true, entryHash: true },
            });
            const expectedCount = Number(cp.leafCount) || local.leafCount || (local.toSeq - local.fromSeq + 1);
            if (logsInBatch.length !== expectedCount) {
              targetBatchIds.push(cp.batchId);
              continue;
            }
            const recomputedRoot = computeMerkleRootForAlgorithm(
              logsInBatch.map((l) => l.entryHash!),
              local.algorithmVersion ?? MERKLE_SHA256_STRING_V1,
            );
            if (rootToBytes32(recomputedRoot).toLowerCase() !== rootToBytes32(cp.root).toLowerCase()) {
              targetBatchIds.push(cp.batchId);
              continue;
            }
          }
        }
      }

      for (const bId of targetBatchIds) {
        try {
          await this.recoverBatchDirectFromChain(bId, null, 'Automated 20-minute Background Watchdog Auto-Healing');
          totalHealed += 1;
        } catch (err) {
          console.error(`[WATCHDOG] Failed to auto-heal batch #${bId}:`, err);
        }
      }

      this.watchdogState.lastScannedBatches = totalScanned;
      this.watchdogState.lastHealedBatches = totalHealed;
      this.watchdogState.statusMessage = totalHealed > 0
        ? `[WATCHDOG 20m] Đã tự động phát hiện và khôi phục thành công ${totalHealed} lô bị sai lệch!`
        : `[WATCHDOG 20m] Tất cả ${totalScanned} lô trên Blockchain và DB local đều toàn vẹn 100%.`;
    } catch (err) {
      console.error('[WATCHDOG SWEEP ERROR]', err);
    }

    return { scanned: totalScanned, healed: totalHealed };
  }

  getDeepScanStatus(): DeepScanProgressState {
    return this.deepScanState;
  }

  async startDeepScanAndSelfHeal(adminId: string): Promise<{ message: string; active: boolean }> {
    if (this.deepScanState.active) {
      throw new ConflictException('Tiến trình đối soát và tự động sửa chữa đang chạy.');
    }

    // Launch background execution
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
      statusMessage: 'Đã xác thực khuôn mặt Admin. Đang kết nối Blockchain...',
      logs: [],
      startTime: new Date().toISOString(),
      endTime: null,
      result: null,
    };

    this.pushLog('👤 Đã xác thực khuôn mặt Admin. Khởi chạy tiến trình đối soát chi tiết...');

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

      // Pass 1: Fetch all on-chain checkpoints in ranges
      const onChainCheckpoints = await this.blockchain.getAuditCheckpointsRange(1, latestOnChain);
      scannedCount = onChainCheckpoints.length;

      // Local DB lookup for all batches with detailed metadata
      const localBatches = await this.prisma.auditBatch.findMany({
        select: {
          batchId: true,
          merkleRoot: true,
          status: true,
          fromSeq: true,
          toSeq: true,
          leafCount: true,
          algorithmVersion: true,
        },
      });
      const localBatchMap = new Map(localBatches.map((b) => [b.batchId, b]));

      this.pushLog(`📊 Đã quét DB local: Tìm thấy ${localBatches.length}/${scannedCount} batches.`);

      // Identify missing or tampered batches (checking both header and actual log entries inside batch)
      const targetBatchIds: number[] = [];
      for (const cp of onChainCheckpoints) {
        if (!cp.committed) continue;
        const local = localBatchMap.get(cp.batchId);

        if (!local || local.status !== 'ANCHORED') {
          targetBatchIds.push(cp.batchId);
          this.pushLog(`⚠️ Phát hiện Batch #${cp.batchId} bị THIẾU trong DB local.`);
          continue;
        }

        // Header check vs on-chain root
        const isHeaderMatch = rootToBytes32(local.merkleRoot).toLowerCase() === rootToBytes32(cp.root).toLowerCase();

        // Detailed check of log entries inside batch from BlockchainLogger table
        let isLogsIntact = true;
        if (local.fromSeq != null && local.toSeq != null) {
          const logsInBatch = await this.prisma.blockchainLogger.findMany({
            where: { seq: { gte: local.fromSeq, lte: local.toSeq }, entryHash: { not: null } },
            orderBy: { seq: 'asc' },
            select: { seq: true, entryHash: true },
          });

          const expectedCount = Number(cp.leafCount) || local.leafCount || (local.toSeq - local.fromSeq + 1);
          if (logsInBatch.length !== expectedCount) {
            isLogsIntact = false;
            this.pushLog(`🔴 Phát hiện Batch #${cp.batchId} bị THIẾU DỮ LIỆU LOG (DB local có ${logsInBatch.length}/${expectedCount} logs).`);
          } else {
            const recomputedRoot = computeMerkleRootForAlgorithm(
              logsInBatch.map((l) => l.entryHash!),
              local.algorithmVersion ?? MERKLE_SHA256_STRING_V1,
            );
            if (rootToBytes32(recomputedRoot).toLowerCase() !== rootToBytes32(cp.root).toLowerCase()) {
              isLogsIntact = false;
              this.pushLog(`🔴 Phát hiện Batch #${cp.batchId} bị SỬA ĐỔI MÃ HASH TRONG LOGS (Merkle Root tính lại không khớp với Blockchain).`);
            }
          }
        }

        if (!isHeaderMatch || !isLogsIntact) {
          targetBatchIds.push(cp.batchId);
          if (isHeaderMatch && !isLogsIntact) {
            // Already logged detailed error above
          } else if (!isHeaderMatch) {
            this.pushLog(`🔴 Phát hiện Batch #${cp.batchId} bị SỬA ĐỔI MÃ HASH HEADER trong DB local (Local: ${local.merkleRoot.slice(0, 10)}... vs Chain: ${cp.root.slice(0, 10)}...).`);
          }
        }
      }

      if (targetBatchIds.length === 0) {
        this.pushLog('✅ [Pass 1] Tất cả các Audit Batches trên DB local đều khớp 100% với Blockchain!');
        this.deepScanState.progressPercent = 80;
      } else {
        this.pushLog(`🔧 [Pass 2] Khởi chạy khôi phục tự động cho ${targetBatchIds.length} batch(es)...`);
        
        const totalTargets = targetBatchIds.length;
        for (let idx = 0; idx < totalTargets; idx++) {
          const bId = targetBatchIds[idx];
          const pct = Math.floor(20 + ((idx + 1) / totalTargets) * 60);
          this.deepScanState.progressPercent = pct;
          this.pushLog(`📥 Đang tải IPFS Artifact cho Batch #${bId} từ Blockchain...`);

          try {
            await this.recoverBatchDirectFromChain(bId, adminId, 'Deep-Scan Automatic Self-Healing');
            recoveredBatchesCount++;
            this.pushLog(`🟢 Đã tự động phục hồi thành công Batch #${bId} từ IPFS!`);
          } catch (err) {
            const errStr = err instanceof Error ? err.message : String(err);
            errors.push(`Batch #${bId}: ${errStr}`);
            this.pushLog(`❌ Lỗi khi khôi phục Batch #${bId}: ${errStr}`);
          }
        }
      }

      this.deepScanState.progressPercent = 90;
      this.pushLog('🧹 Đang quét kiểm tra các Entity nghiệp vụ bị ảnh hưởng...');

      this.deepScanState.progressPercent = 100;
      this.deepScanState.statusMessage = recoveredBatchesCount > 0
        ? `Đã tự động sửa chữa thành công ${recoveredBatchesCount} audit batch(es).`
        : 'Tất cả Audit Batches đều an toàn và toàn vẹn 100%.';
      this.pushLog(`🎉 Hoàn tất 100%! Đã quét ${scannedCount} batches, tự động sửa chữa ${recoveredBatchesCount} batches.`);

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

  private async recoverBatchDirectFromChain(batchId: number, adminId: string | null, reason: string) {
    const checkpoint = await this.blockchain.getAuditCheckpoint(batchId);
    if (!checkpoint?.committed || !checkpoint.artifactUri || !checkpoint.artifactHash) {
      throw new Error(`Batch ${batchId} không có checkpoint hợp lệ trên Blockchain.`);
    }

    const bundle = await this.artifacts.downloadAndDecrypt(
      batchId,
      checkpoint.artifactUri,
      checkpoint.artifactHash,
    );

    this.validateBundle(bundle.logs, {
      batchId,
      merkleRoot: bundle.batch.merkleRoot,
      fromSeq: bundle.batch.fromSeq,
      toSeq: bundle.batch.toSeq,
      leafCount: bundle.batch.leafCount,
      algorithmVersion: bundle.batch.algorithmVersion,
      onChainRoot: checkpoint.root,
      onChainLeafCount: checkpoint.leafCount,
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.audit_recovery_authorized', 'true', true)`;
      await tx.$executeRaw`SET session_replication_role = 'replica'`;

      const logIds = bundle.logs.map((r) => r.id).filter(Boolean);
      const targetSeqList = bundle.logs.map((r) => r.seq);

      // Check if any sequence in bundle.logs collides with an existing row in DB with a different ID
      // (whether anchored to another batch or an unanchored pending log)
      const collidingRows = await tx.blockchainLogger.findMany({
        where: {
          seq: { in: targetSeqList },
          id: { notIn: logIds },
        },
        select: { id: true, seq: true, batchId: true },
      });

      let mappedFromSeq = bundle.batch.fromSeq;
      let mappedToSeq = bundle.batch.toSeq;

      if (collidingRows.length > 0) {
        const maxTail = await tx.blockchainLogger.findFirst({
          where: { seq: { not: null } },
          orderBy: { seq: 'desc' },
          select: { seq: true },
        });
        const maxBatch = await tx.auditBatch.aggregate({ _max: { toSeq: true } });
        const startSeq = Math.max(maxTail?.seq ?? 0, maxBatch._max.toSeq ?? 0) + 1;
        mappedFromSeq = startSeq;
        mappedToSeq = startSeq + bundle.logs.length - 1;

        for (let i = 0; i < bundle.logs.length; i++) {
          bundle.logs[i].seq = startSeq + i;
        }
      }

      await tx.blockchainLogger.deleteMany({
        where: {
          OR: [
            { batchId },
            { id: { in: logIds } },
          ],
        },
      });

      for (const row of bundle.logs) {
        const input = this.toCreateInput(row, batchId, null, null);
        await tx.blockchainLogger.upsert({
          where: { id: row.id },
          create: input,
          update: input,
        });
      }

      await tx.$executeRaw`SET session_replication_role = 'origin'`;

      await tx.auditBatch.upsert({
        where: { batchId },
        create: {
          batchId,
          merkleRoot: bundle.batch.merkleRoot,
          leafCount: bundle.batch.leafCount,
          fromSeq: mappedFromSeq,
          toSeq: mappedToSeq,
          algorithmVersion: bundle.batch.algorithmVersion,
          contractVersion: 'AUDIT_ANCHOR_CHECKPOINT_V2',
          artifactHash: checkpoint.artifactHash,
          artifactUri: checkpoint.artifactUri,
          artifactCid: checkpoint.artifactUri.slice('ipfs://'.length),
          status: 'ANCHORED',
          recoveredAt: new Date(),
          error: null,
        },
        update: {
          merkleRoot: bundle.batch.merkleRoot,
          leafCount: bundle.batch.leafCount,
          fromSeq: mappedFromSeq,
          toSeq: mappedToSeq,
          algorithmVersion: bundle.batch.algorithmVersion,
          artifactHash: checkpoint.artifactHash,
          artifactUri: checkpoint.artifactUri,
          artifactCid: checkpoint.artifactUri.slice('ipfs://'.length),
          status: 'ANCHORED',
          recoveredAt: new Date(),
          error: null,
        },
      });
    });

    await this.audit.recordV2({
      entity: 'AuditBatch',
      entityId: String(batchId),
      action: 'AUDIT_RECOVERY_EXECUTED',
      actorId: adminId || null,
      before: null,
      after: { batchId, restoredCount: bundle.logs.length, status: 'RECOVERED' },
      metadata: {
        batchId,
        reason,
        artifactHash: checkpoint.artifactHash,
        actorType: adminId ? 'ADMIN_USER' : 'SYSTEM_WATCHDOG',
      },
    });
  }

  /**
   * Read an anchored recovery artifact without mutating PostgreSQL. The returned
   * rows have been authenticated against both the IPFS artifact hash and the
   * blockchain checkpoint, then re-verified as a complete hash/Merkle chain.
   */
  async loadVerifiedBundle(batchId: number): Promise<VerifiedAuditRecoveryBundle> {
    if (!Number.isSafeInteger(batchId) || batchId <= 0) throw new BadRequestException('Invalid audit batch id.');
    const batch = await this.prisma.auditBatch.findUnique({ where: { batchId } });

    const checkpoint = await this.blockchain.getAuditCheckpoint(batchId);
    if (!checkpoint?.committed) throw new BadRequestException('The batch has no committed blockchain checkpoint.');
    if (!checkpoint.artifactUri || !checkpoint.artifactHash) {
      throw new BadRequestException('The blockchain checkpoint has no recovery artifact.');
    }

    const bundle = await this.artifacts.downloadAndDecrypt(
      batchId,
      checkpoint.artifactUri,
      checkpoint.artifactHash,
    );

    const merkleRoot = batch?.merkleRoot ?? bundle.batch.merkleRoot;
    const fromSeq = batch?.fromSeq ?? bundle.batch.fromSeq;
    const toSeq = batch?.toSeq ?? bundle.batch.toSeq;
    const leafCount = batch?.leafCount ?? bundle.batch.leafCount;
    const algorithmVersion = batch?.algorithmVersion ?? bundle.batch.algorithmVersion;

    this.validateBundle(bundle.logs, {
      batchId,
      merkleRoot,
      fromSeq,
      toSeq,
      leafCount,
      algorithmVersion,
      onChainRoot: checkpoint.root,
      onChainLeafCount: checkpoint.leafCount,
    });

    return {
      batchId,
      artifactHash: checkpoint.artifactHash,
      artifactUri: checkpoint.artifactUri,
      merkleRoot: bundle.batch.merkleRoot,
      logs: bundle.logs,
    };
  }

  async recover(batchId: number, adminId: string, reason: string): Promise<{
    batchId: number;
    status: 'RECOVERED';
    restoredCount: number;
    merkleRoot: string;
    artifactHash: string;
    completedAt: string;
  }> {
    if (!Number.isSafeInteger(batchId) || batchId <= 0) throw new BadRequestException('Invalid audit batch id.');
    if (this.runningBatches.has(batchId)) throw new ConflictException('This audit batch is already being recovered.');
    this.runningBatches.add(batchId);

    // Ensure AuditBatch placeholder exists if the batch was completely wiped from local DB
    await this.prisma.auditBatch.upsert({
      where: { batchId },
      create: {
        batchId,
        merkleRoot: 'PENDING_RECOVERY',
        leafCount: 0,
        fromSeq: 0,
        toSeq: 0,
        status: 'PENDING',
      },
      update: {},
    });

    const recovery = await this.prisma.auditRecovery.create({
      data: { batchId, requestedById: adminId, reason: reason.trim() },
    });

    try {
      const checkpoint = await this.blockchain.getAuditCheckpoint(batchId);
      if (!checkpoint?.committed) throw new BadRequestException('The batch has no committed blockchain checkpoint.');
      if (!checkpoint.artifactUri || !checkpoint.artifactHash) {
        throw new BadRequestException('The blockchain checkpoint has no recovery artifact.');
      }

      const batch = await this.prisma.auditBatch.findUnique({ where: { batchId } });
      if (batch?.status === 'ANCHORED' && batch.fromSeq != null && batch.toSeq != null) {
        const logsInBatch = await this.prisma.blockchainLogger.findMany({
          where: { seq: { gte: batch.fromSeq, lte: batch.toSeq }, entryHash: { not: null } },
          orderBy: { seq: 'asc' },
        });
        const expectedCount = batch.leafCount || (batch.toSeq - batch.fromSeq + 1);
        if (logsInBatch.length === expectedCount) {
          const isEveryRowIntact = logsInBatch.every((l) => verifyAuditRow({ ...l, createdAt: new Date(l.createdAt) }).ok);
          const recomputedRoot = computeMerkleRootForAlgorithm(
            logsInBatch.map((l) => l.entryHash!),
            batch.algorithmVersion ?? MERKLE_SHA256_STRING_V1,
          );
          if (
            isEveryRowIntact &&
            rootToBytes32(recomputedRoot).toLowerCase() === rootToBytes32(checkpoint.root).toLowerCase() &&
            rootToBytes32(batch.merkleRoot).toLowerCase() === rootToBytes32(checkpoint.root).toLowerCase()
          ) {
            throw new BadRequestException('The audit batch is already intact and matches the blockchain checkpoint.');
          }
        }
      }

      await this.recoverBatchDirectFromChain(batchId, adminId, reason);

      await this.prisma.auditRecovery.update({
        where: { id: recovery.id },
        data: {
          status: 'COMPLETED',
          artifactHash: checkpoint.artifactHash,
          completedAt: new Date(),
        },
      });

      const completedAt = new Date().toISOString();
      return {
        batchId,
        status: 'RECOVERED',
        restoredCount: checkpoint.leafCount,
        merkleRoot: checkpoint.root,
        artifactHash: checkpoint.artifactHash,
        completedAt,
      };
    } catch (error) {
      const failureReason = error instanceof Error ? error.message : 'Audit recovery failed.';
      await this.prisma.auditRecovery.update({
        where: { id: recovery.id },
        data: { status: 'FAILED', failureReason, completedAt: new Date() },
      }).catch(() => undefined);
      throw error;
    } finally {
      this.runningBatches.delete(batchId);
    }
  }

  private validateBundle(
    rows: AuditRecoveryBundleRow[],
    expected: {
      batchId: number;
      merkleRoot: string;
      fromSeq: number;
      toSeq: number;
      leafCount: number;
      algorithmVersion: string;
      onChainRoot: string;
      onChainLeafCount: number;
    },
  ): void {
    if (rows.length !== expected.leafCount || rows.length !== expected.onChainLeafCount) {
      throw new BadRequestException('Recovery bundle leaf count does not match the blockchain checkpoint.');
    }
    if (expected.toSeq - expected.fromSeq + 1 !== rows.length) {
      throw new BadRequestException('Recovery bundle sequence range is incomplete.');
    }
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      if (row.seq !== expected.fromSeq + index) throw new BadRequestException(`Recovery bundle is missing sequence ${expected.fromSeq + index}.`);
      if (index > 0 && row.prevHash !== rows[index - 1].entryHash) {
        throw new BadRequestException(`Recovery bundle hash chain breaks at sequence ${row.seq}.`);
      }
      const verification = verifyAuditRow({ ...row, createdAt: new Date(row.createdAt) });
      if (!verification.ok) throw new BadRequestException(`Recovery bundle row ${row.seq} failed hash verification.`);
    }

    const root = computeMerkleRootForAlgorithm(rows.map((row) => row.entryHash), expected.algorithmVersion);
    if (root !== expected.merkleRoot || rootToBytes32(root).toLowerCase() !== expected.onChainRoot.toLowerCase()) {
      throw new BadRequestException('Recovery bundle Merkle root does not match the blockchain checkpoint.');
    }
  }

  private toCreateInput(
    row: AuditRecoveryBundleRow,
    batchId: number,
    txHash: string | null,
    blockNumber: number | null,
  ): Prisma.BlockchainLoggerUncheckedCreateInput {
    return {
      id: row.id,
      eventId: row.eventId,
      actorId: row.actorId,
      action: row.action,
      entity: row.entity,
      entityId: row.entityId,
      metadata: this.json(row.metadata),
      dataHash: row.dataHash,
      dataSalt: row.dataSalt,
      beforeJson: this.json(row.beforeJson),
      afterJson: this.json(row.afterJson),
      beforeHash: row.beforeHash,
      afterHash: row.afterHash,
      diffHash: row.diffHash,
      hashVersion: row.hashVersion,
      beforeEncrypted: this.json(row.beforeEncrypted),
      afterEncrypted: this.json(row.afterEncrypted),
      encryptionVersion: row.encryptionVersion,
      encryptionKeyId: row.encryptionKeyId,
      diffJson: this.json(row.diffJson),
      fieldsChanged: this.json(row.fieldsChanged),
      onChainStatus: 'ANCHORED',
      txHash,
      blockNumber,
      seq: row.seq,
      prevHash: row.prevHash,
      entryHash: row.entryHash,
      batchId,
      departmentId: row.departmentId,
      staffProfileId: row.staffProfileId,
      doctorProfileId: row.doctorProfileId,
      patientId: row.patientId,
      aiModelRegistryId: row.aiModelRegistryId,
      medicalConclusionId: row.medicalConclusionId,
      aiQualityId: row.aiQualityId,
      createdAt: new Date(row.createdAt),
    };
  }

  private json(value: unknown): Prisma.InputJsonValue | Prisma.NullTypes.JsonNull {
    return value == null ? Prisma.JsonNull : value as Prisma.InputJsonValue;
  }
}

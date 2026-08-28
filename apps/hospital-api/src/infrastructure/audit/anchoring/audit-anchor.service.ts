import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { computeMerkleRootForAlgorithm, MERKLE_SHA256_BYTES32_V2, rootToBytes32 } from '../crypto/merkle.util';
import { ensureBlockchainLoggerAppendOnlyTrigger } from './audit-anchor-trigger.sql';
import { AuditTelegramAlertService } from './audit-telegram-alert.service';
import { AuditChainVerifier } from './audit-chain-verifier';
import { AuditProofService } from './audit-proof.service';
import { AuditBatchArtifactPublisher } from './audit-batch-artifact-publisher';
import { AuditPendingBatchResumer } from './audit-pending-batch-resumer';
import { AuditBatchPreparer } from './audit-batch-preparer';

/**
 * AuditAnchorService coordinates periodic batch anchoring of audit logs,
 * Merkle tree generation, encrypted IPFS artifact creation, and on-chain checkpoint commits.
 */
@Injectable()
export class AuditAnchorService implements OnModuleInit, OnModuleDestroy, OnApplicationBootstrap {
  private readonly logger = new Logger(AuditAnchorService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  private readonly intervalMs = Number(process.env.AUDIT_BATCH_INTERVAL_MS ?? 30 * 1000);
  private readonly maxLeaves = Number(process.env.AUDIT_BATCH_MAX_LEAVES ?? 500);
  private readonly merkleAlgorithm = MERKLE_SHA256_BYTES32_V2;
  private readonly contractVersion = 'AUDIT_ANCHOR_CHECKPOINT_V2';

  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchain: BlockchainService,
    private readonly alerts: AuditTelegramAlertService,
    private readonly verifier: AuditChainVerifier,
    private readonly proofs: AuditProofService,
    private readonly publisher: AuditBatchArtifactPublisher,
    private readonly resumer: AuditPendingBatchResumer,
    private readonly preparer: AuditBatchPreparer,
  ) {}

  clearCache(): void {
    this.proofs.clearCache();
  }

  onModuleInit() {
    if (process.env.SKIP_PRISMA_CONNECT !== 'true') {
      ensureBlockchainLoggerAppendOnlyTrigger(this.prisma).catch((err) =>
        this.logger.error('Failed to ensure append-only trigger', err),
      );
    }

    if (process.env.AUDIT_BATCH_DISABLED === 'true') {
      this.logger.warn('Audit batch anchoring disabled via AUDIT_BATCH_DISABLED.');
      return;
    }
    this.timer = setInterval(() => {
      this.runCycle().catch((err) => this.logger.error('Audit batch cycle failed', err));
    }, this.intervalMs);
    this.logger.log(`Audit batch anchoring scheduled every ${this.intervalMs}ms (max ${this.maxLeaves} leaves/batch).`);
  }

  async onApplicationBootstrap() {
    try {
      if (process.env.AUDIT_BATCH_DISABLED === 'true') return;

      try {
        this.publisher.assertReady();
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Audit recovery configuration is invalid.';
        this.logger.error(`Audit batch anchoring is paused: ${reason}`);
        return;
      }

      await this.resumer.recoverPendingBatches();

      const onChainLatest = await this.blockchain.getLatestAuditBatchId();
      if (onChainLatest === 0 || onChainLatest === null) {
        this.logger.log('🚀 [Genesis Anchor] Detected empty blockchain state. Checking for initial logs...');

        const pendingCount = await this.prisma.blockchainLogger.count({
          where: { batchId: null, seq: { not: null }, entryHash: { not: null } },
        });

        if (pendingCount > 0) {
          this.logger.log(`🚀 [Genesis Anchor] Found ${pendingCount} unanchored logs. Committing Batch 1 immediately...`);
          const res = await this.anchorNow();
          if (res.committed) {
            this.logger.log('✅ [Genesis Anchor] Genesis Batch 1 anchored successfully!');
          } else {
            this.logger.warn(`⚠️ [Genesis Anchor] Genesis Batch 1 anchor failed: ${res.reason}`);
          }
        }
      }
    } catch (err) {
      this.logger.error('Failed to execute Genesis Anchor on bootstrap:', err);
    }
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async anchorNow(): Promise<{ committed: boolean; batchId?: number; leafCount?: number; reason?: string }> {
    return this.runCycle(true);
  }

  async anchorNowWithinRecovery(): Promise<{ committed: boolean; batchId?: number; leafCount?: number; reason?: string }> {
    return this.runCycle(true, true);
  }

  async rechainLocalBlockchainLogger(): Promise<{ recomputed: number; total: number }> {
    return this.verifier.rechainLocalBlockchainLogger();
  }

  async getLatestCheckpointBatchId(): Promise<number | null> {
    return this.blockchain.getLatestAuditBatchId(true);
  }

  async getCheckpointSequenceRange(batchId: number): Promise<{ fromSeq: number; toSeq: number } | null> {
    const checkpoint = await this.blockchain.getAuditCheckpoint(batchId);
    if (!checkpoint?.committed) return null;
    return { fromSeq: checkpoint.fromSeq, toSeq: checkpoint.toSeq };
  }

  async getInclusionProof(seq: number, client: PrismaService | Prisma.TransactionClient = this.prisma) {
    return this.proofs.getInclusionProof(seq, client);
  }

  async getLatestVerifiedCheckpointBefore(targetSeq: number, client: PrismaService | Prisma.TransactionClient = this.prisma) {
    return this.proofs.getLatestVerifiedCheckpointBefore(targetSeq, client);
  }

  async verifyAllAnchoredBatchesAgainstChain() {
    return this.verifier.verifyAllAnchoredBatchesAgainstChain();
  }

  async verifySingleAnchoredBatch(batchId: number) {
    return this.verifier.verifySingleAnchoredBatch(batchId);
  }

  async sendTelegramAlert(title: string, details: string, brokenSeq?: number): Promise<void> {
    return this.alerts.sendTelegramAlert(title, details, brokenSeq);
  }

  private async runCycle(force = false, isRecovery = false): Promise<{ committed: boolean; batchId?: number; leafCount?: number; reason?: string }> {
    if (this.running) return { committed: false, reason: 'Chu trình neo đang chạy.' };
    this.running = true;
    try {
      if (!this.blockchain.isAuditAnchorReady()) {
        return { committed: false, reason: 'Chưa cấu hình AuditAnchor.' };
      }

      try {
        this.publisher.assertReady();
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Audit recovery configuration is invalid.';
        return { committed: false, reason };
      }

      if (!isRecovery) {
        const chainCheck = await this.verifier.verifyFullChainBeforeAnchor();
        if (!chainCheck.ok) {
          const reason = chainCheck.reason ?? 'Không xác định được lỗi toàn vẹn chuỗi.';
          this.logger.error(`🚨 FULL CHAIN INTEGRITY FAILURE DETECTED: ${reason}. Aborting commit.`);
          await this.alerts.sendTelegramAlert('Cảnh báo giả mạo Blockchain Logger (Full-Chain)', reason, chainCheck.brokenAtSeq ?? undefined);
          return { committed: false, reason: `Kiểm tra toàn chuỗi thất bại: ${reason}` };
        }

        const anchoredCheck = await this.verifier.verifyAllAnchoredBatchesAgainstChain();
        if (!anchoredCheck.ok) {
          const reason = anchoredCheck.reason ?? 'Không xác định được lỗi batch đã neo.';
          this.logger.error(`🚨 ANCHORED BATCH INTEGRITY FAILURE DETECTED: ${reason}. Aborting commit.`);
          await this.alerts.sendTelegramAlert('Cảnh báo batch audit đã neo bị lệch', reason);
          return { committed: false, reason: `Kiểm tra batch đã neo thất bại: ${reason}` };
        }
      }

      await this.resumer.recoverPendingBatches();
      const incomplete = await this.prisma.auditBatch.findFirst({
        where: { status: { in: ['PREPARING', 'ARTIFACT_READY', 'ON_CHAIN_CONFIRMED'] } },
        orderBy: { batchId: 'asc' },
        select: { batchId: true },
      });
      if (incomplete) {
        return { committed: false, batchId: incomplete.batchId, reason: 'An incomplete batch must be resumed before creating a new batch.' };
      }

      const pending = await this.preparer.loadPendingLeaves(this.maxLeaves);
      if (pending.length === 0) return { committed: false, reason: 'Không có bản ghi nào cần neo.' };
      void force;

      try {
        await this.preparer.validatePendingChain(pending, isRecovery);
      } catch (valErr: any) {
        const brokenSeq = pending[0]?.seq ?? 0;
        const reason = valErr.message || 'Không xác định được lỗi toàn vẹn chuỗi.';
        this.logger.error(`🚨 CHAIN INTEGRITY FAILURE DETECTED: ${reason}. Aborting commit.`);
        await this.alerts.sendTelegramAlert('Cảnh báo giả mạo Blockchain Logger (Pre-Commit)', reason, brokenSeq);
        return { committed: false, reason: `Kiểm tra chuỗi thất bại: ${reason}` };
      }

      const batchId = await this.preparer.calculateNextBatchId();
      const entryHashes = pending.map((p) => p.entryHash!);
      const merkleRoot = computeMerkleRootForAlgorithm(entryHashes, this.merkleAlgorithm);
      const fromSeq = pending[0].seq!;
      const toSeq = pending[pending.length - 1].seq!;

      await this.prisma.auditBatch.create({
        data: {
          batchId,
          merkleRoot,
          leafCount: pending.length,
          fromSeq,
          toSeq,
          status: 'PREPARING',
          algorithmVersion: this.merkleAlgorithm,
          contractVersion: this.contractVersion,
        },
      });

      let artifact;
      try {
        artifact = await this.publisher.createAndUploadBatchArtifact({
          batchId,
          merkleRoot,
          leafCount: pending.length,
          fromSeq,
          toSeq,
          algorithmVersion: this.merkleAlgorithm,
        });
        await this.prisma.auditBatch.update({
          where: { batchId },
          data: { ...artifact, status: 'ARTIFACT_READY', error: null },
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'IPFS artifact creation failed.';
        await this.prisma.auditBatch.update({ where: { batchId }, data: { error: reason } });
        return { committed: false, batchId, reason };
      }

      const res = await this.blockchain.commitAuditCheckpoint(
        batchId,
        rootToBytes32(merkleRoot),
        pending.length,
        fromSeq,
        toSeq,
        artifact.artifactHash,
        artifact.artifactUri,
      );

      if (!res || !res.success) {
        const errReason = res && 'error' in res ? (res as any).error : 'Blockchain checkpoint commit failed.';
        await this.prisma.auditBatch.update({
          where: { batchId },
          data: { status: 'ARTIFACT_READY', error: errReason },
        });
        this.logger.error(`Batch ${batchId} commit failed: ${errReason}`);
        return { committed: false, batchId, reason: errReason };
      }

      await this.prisma.auditBatch.update({
        where: { batchId },
        data: {
          status: 'ON_CHAIN_CONFIRMED',
          txHash: (res as any).txHash ?? null,
          blockNumber: (res as any).blockNumber ?? null,
          error: null,
        },
      });

      const txHash = (res as any).txHash ?? null;
      const blockNumber = (res as any).blockNumber ?? null;
      await this.prisma.$transaction([
        this.prisma.auditBatch.update({
          where: { batchId },
          data: { status: 'ANCHORED', txHash, blockNumber, anchoredAt: new Date() },
        }),
        this.prisma.blockchainLogger.updateMany({
          where: { id: { in: pending.map((p) => p.id) } },
          data: { batchId, onChainStatus: 'ANCHORED', txHash, blockNumber },
        }),
      ]);
      this.logger.log(`Batch ${batchId} anchored: ${pending.length} logs (seq ${fromSeq}-${toSeq}), tx ${txHash}`);
      return { committed: true, batchId, leafCount: pending.length };
    } finally {
      this.running = false;
    }
  }
}
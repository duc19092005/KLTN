import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { computeMerkleRootForAlgorithm, MERKLE_SHA256_STRING_V1, rootToBytes32 } from '../crypto/merkle.util';
import { verifyAuditRow } from '../logging/audit-verification.util';
import { DeepScanProgressState, VerifiedAuditRecoveryBundle, WatchdogState } from './deep-scan-state';
import { VerifiedAuditBundleReader } from './verified-audit-bundle.reader';
import { AuditWatchdogScheduler } from './audit-watchdog.scheduler';
import { AuditDeepScanService } from './audit-deep-scan.service';
import { AuditBatchRestorer } from './audit-batch-restorer';
export * from './deep-scan-state';

/**
 * AuditRecoveryService coordinates administrative deep-scanning, background watchdog
 * self-healing, and IPFS artifact reconstruction for corrupted audit batches.
 */
@Injectable()
export class AuditRecoveryService {
  private readonly runningBatches = new Set<number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchain: BlockchainService,
    private readonly verifiedReader: VerifiedAuditBundleReader,
    private readonly watchdog: AuditWatchdogScheduler,
    private readonly deepScan: AuditDeepScanService,
    private readonly restorer: AuditBatchRestorer,
  ) {}

  getWatchdogStatus(): WatchdogState {
    return this.watchdog.getWatchdogStatus();
  }

  async runWatchdogAutoHealSweep(): Promise<{ scanned: number; healed: number }> {
    return this.watchdog.runWatchdogAutoHealSweep(() => this.deepScan.isDeepScanActive());
  }

  getDeepScanStatus(): DeepScanProgressState {
    return this.deepScan.getDeepScanStatus();
  }

  async startDeepScanAndSelfHeal(adminId: string): Promise<{ message: string; active: boolean }> {
    return this.deepScan.startDeepScanAndSelfHeal(adminId);
  }

  async loadVerifiedBundle(batchId: number): Promise<VerifiedAuditRecoveryBundle> {
    return this.verifiedReader.loadVerifiedBundle(batchId);
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

      await this.restorer.recoverBatchDirectFromChain(batchId, adminId, reason);

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
}
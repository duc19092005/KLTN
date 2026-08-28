import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { computeMerkleRootForAlgorithm, MERKLE_SHA256_STRING_V1, rootToBytes32 } from '../crypto/merkle.util';
import { AuditBatchArtifactPublisher } from './audit-batch-artifact-publisher';
import { AuditTelegramAlertService } from './audit-telegram-alert.service';

@Injectable()
export class AuditPendingBatchResumer {
  private readonly logger = new Logger(AuditPendingBatchResumer.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchain: BlockchainService,
    private readonly publisher: AuditBatchArtifactPublisher,
    private readonly alertService: AuditTelegramAlertService,
  ) {}

  async validateRecoverableBatchMembership(batch: {
    batchId: number;
    merkleRoot: string;
    leafCount: number;
    fromSeq: number | null;
    toSeq: number | null;
    algorithmVersion: string | null;
  }): Promise<{ ok: boolean; reason?: string }> {
    if (batch.fromSeq == null || batch.toSeq == null) {
      return { ok: false, reason: `Pending batch ${batch.batchId} thiếu fromSeq/toSeq.` };
    }
    if (batch.fromSeq > batch.toSeq) {
      return { ok: false, reason: `Pending batch ${batch.batchId} có range seq không hợp lệ.` };
    }

    const logs = await this.prisma.blockchainLogger.findMany({
      where: { seq: { gte: batch.fromSeq, lte: batch.toSeq } },
      orderBy: { seq: 'asc' },
      select: { id: true, seq: true, entryHash: true },
    });

    if (logs.length !== batch.leafCount) {
      return { ok: false, reason: `Pending batch ${batch.batchId} leafCount mismatch: expected ${batch.leafCount}, got ${logs.length}.` };
    }

    const expectedCount = batch.toSeq - batch.fromSeq + 1;
    if (logs.length !== expectedCount) {
      return { ok: false, reason: `Pending batch ${batch.batchId} sequence range is not fully covered.` };
    }

    for (let index = 0; index < logs.length; index += 1) {
      const expectedSeq = batch.fromSeq + index;
      const log = logs[index];
      if (log.seq !== expectedSeq) {
        return { ok: false, reason: `Pending batch ${batch.batchId} missing seq ${expectedSeq}.` };
      }
      if (!log.entryHash) {
        return { ok: false, reason: `Pending batch ${batch.batchId} log seq ${expectedSeq} missing entryHash.` };
      }
    }

    const recomputedRoot = computeMerkleRootForAlgorithm(
      logs.map((log) => log.entryHash!),
      batch.algorithmVersion ?? MERKLE_SHA256_STRING_V1,
    );
    if (recomputedRoot !== batch.merkleRoot) {
      return { ok: false, reason: `Pending batch ${batch.batchId} recomputed root does not match stored root.` };
    }

    return { ok: true };
  }

  async recoverPendingBatches(): Promise<void> {
    const batches = await this.prisma.auditBatch.findMany({
      where: { status: { in: ['PENDING', 'PREPARING', 'ARTIFACT_READY', 'ON_CHAIN_CONFIRMED', 'ANCHORED'] } },
      orderBy: { batchId: 'asc' },
      select: {
        batchId: true,
        status: true,
        merkleRoot: true,
        leafCount: true,
        fromSeq: true,
        toSeq: true,
        createdAt: true,
        algorithmVersion: true,
        contractVersion: true,
        artifactHash: true,
        artifactUri: true,
        artifactCid: true,
        artifactKeyId: true,
      },
    });

    if (batches.length === 0) return;

    for (const batch of batches) {
      try {
        const localRootBytes32 = rootToBytes32(batch.merkleRoot).toLowerCase();
        const checkpoint = await this.blockchain.getAuditCheckpoint(batch.batchId);
        const onChainRoot = checkpoint?.root?.toLowerCase();

        if (batch.status === 'ANCHORED' && checkpoint?.committed && onChainRoot === localRootBytes32) {
          continue;
        }

        if (batch.status === 'PENDING') {
          await this.prisma.auditBatch.update({
            where: { batchId: batch.batchId },
            data: { status: 'PREPARING' },
          });
          continue;
        }

        if (batch.status === 'PREPARING' || (!batch.artifactHash && !checkpoint?.committed)) {
          if (batch.fromSeq == null || batch.toSeq == null) throw new Error('Incomplete batch has no sequence range.');
          const artifact = await this.publisher.createAndUploadBatchArtifact({
            batchId: batch.batchId,
            merkleRoot: batch.merkleRoot,
            leafCount: batch.leafCount,
            fromSeq: batch.fromSeq,
            toSeq: batch.toSeq,
            algorithmVersion: batch.algorithmVersion,
          });
          await this.prisma.auditBatch.update({
            where: { batchId: batch.batchId },
            data: { ...artifact, status: 'ARTIFACT_READY', error: null },
          });
          batch.artifactHash = artifact.artifactHash;
          batch.artifactUri = artifact.artifactUri;
          batch.status = 'ARTIFACT_READY';
        }

        if (!checkpoint?.committed) {
          const onChainLatest = (await this.blockchain.getLatestAuditBatchId(true)) ?? 0;
          if (batch.batchId === onChainLatest + 1) {
            if (!batch.artifactHash || !batch.artifactUri) {
              const artifact = await this.publisher.createAndUploadBatchArtifact({
                batchId: batch.batchId,
                merkleRoot: batch.merkleRoot,
                leafCount: batch.leafCount,
                fromSeq: batch.fromSeq!,
                toSeq: batch.toSeq!,
                algorithmVersion: batch.algorithmVersion,
              });
              batch.artifactHash = artifact.artifactHash;
              batch.artifactUri = artifact.artifactUri;
            }

            const result = await this.blockchain.commitAuditCheckpoint(
              batch.batchId,
              localRootBytes32,
              batch.leafCount,
              batch.fromSeq!,
              batch.toSeq!,
              batch.artifactHash,
              batch.artifactUri,
            );
            if (!result || !result.success) {
              const reason = result && 'error' in result ? (result as any).error : 'Blockchain checkpoint commit failed.';
              await this.prisma.auditBatch.update({ where: { batchId: batch.batchId }, data: { error: reason } });
              continue;
            }
            await this.prisma.$transaction([
              this.prisma.auditBatch.update({
                where: { batchId: batch.batchId },
                data: {
                  status: 'ANCHORED',
                  txHash: result.txHash,
                  blockNumber: result.blockNumber,
                  anchoredAt: new Date(),
                  error: null,
                },
              }),
              this.prisma.blockchainLogger.updateMany({
                where: {
                  batchId: null,
                  seq: { gte: batch.fromSeq!, lte: batch.toSeq! },
                },
                data: { batchId: batch.batchId, onChainStatus: 'ANCHORED' },
              }),
            ]);
            this.logger.log(`✅ [AuditAnchorService] Batch ${batch.batchId} synchronized to on-chain contract.`);
            continue;
          }
        }

        if (checkpoint?.committed && onChainRoot === localRootBytes32) {
          if (!batch.artifactHash || !batch.artifactUri
            || checkpoint.artifactHash.toLowerCase() !== batch.artifactHash.toLowerCase()
            || checkpoint.artifactUri !== batch.artifactUri
            || checkpoint.leafCount !== batch.leafCount) {
            throw new Error(`Pending batch ${batch.batchId} artifact metadata does not match on-chain checkpoint.`);
          }
          const membership = await this.validateRecoverableBatchMembership(batch);
          if (!membership.ok) {
            const reason = membership.reason ?? `Pending batch ${batch.batchId} membership validation failed during recovery.`;
            await this.prisma.auditBatch.update({
              where: { batchId: batch.batchId },
              data: { status: 'FAILED', error: reason },
            });
            await this.alertService.sendTelegramAlert('Audit batch recovery membership mismatch', reason, batch.fromSeq ?? undefined);
            continue;
          }

          await this.prisma.$transaction([
            this.prisma.auditBatch.update({
              where: { batchId: batch.batchId },
              data: { status: 'ANCHORED', anchoredAt: new Date(Number(checkpoint.timestamp) * 1000), recoveredAt: new Date() },
            }),
            this.prisma.blockchainLogger.updateMany({
              where: {
                batchId: null,
                seq: { gte: batch.fromSeq!, lte: batch.toSeq! },
              },
              data: { batchId: batch.batchId, onChainStatus: 'ANCHORED' },
            }),
          ]);
          continue;
        }

        if (checkpoint?.committed && onChainRoot !== localRootBytes32) {
          const reason = `Pending batch ${batch.batchId} root mismatch during recovery.`;
          await this.prisma.auditBatch.update({
            where: { batchId: batch.batchId },
            data: { status: 'FAILED', error: reason },
          });
          await this.alertService.sendTelegramAlert('Audit batch recovery root mismatch', reason, batch.fromSeq ?? undefined);
          continue;
        }
      } catch (err) {
        this.logger.error(`Failed to recover pending audit batch ${batch.batchId}`, err);
      }
    }
  }
}
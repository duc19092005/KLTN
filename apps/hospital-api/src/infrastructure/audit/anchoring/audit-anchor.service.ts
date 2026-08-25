import { Injectable, Logger, OnModuleDestroy, OnModuleInit, OnApplicationBootstrap } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BlockchainService } from '../../blockchain/blockchain.service';
import {
  MERKLE_SHA256_STRING_V1,
  MERKLE_SHA256_BYTES32_V2,
  buildMerkleProofForAlgorithm,
  computeMerkleRootForAlgorithm,
  rootToBytes32,
  verifyMerkleProofForAlgorithm,
} from '../crypto/merkle.util';
import { AUDIT_ENTRY_V2, computeEntryHashV2, GENESIS_PREV_HASH } from '../crypto/audit-hash.util';
import { AuditArtifactService, AuditRecoveryBundleRow } from '../ipfs/audit-artifact.service';
import { ensureBlockchainLoggerAppendOnlyTrigger } from './audit-anchor-trigger.sql';

/**
 * AuditAnchorService periodically seals batches of audit logs, builds a Merkle tree
 * over their entryHashes, uploads an encrypted recovery artifact to IPFS, and commits
 * a checkpoint to Ethereum/Hardhat smart contract.
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
  private readonly onChainRootCache = new Map<number, string>();

  clearCache(): void {
    this.onChainRootCache.clear();
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchain: BlockchainService,
    private readonly artifacts: AuditArtifactService,
  ) {}

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
        this.artifacts.assertReady();
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Audit recovery configuration is invalid.';
        this.logger.error(`Audit batch anchoring is paused: ${reason}`);
        return;
      }

      await this.recoverPendingBatches();

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
            this.logger.log(`✅ [Genesis Anchor] Genesis Batch 1 anchored successfully!`);
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
    const rows = await this.prisma.blockchainLogger.findMany({
      where: { seq: { not: null } },
      orderBy: { seq: 'asc' },
    });
    if (rows.length === 0) return { recomputed: 0, total: 0 };

    const firstUnanchoredIndex = rows.findIndex((row) => row.onChainStatus !== 'ANCHORED' || row.batchId == null);
    if (firstUnanchoredIndex < 0) return { recomputed: 0, total: rows.length };

    const predecessor = firstUnanchoredIndex > 0 ? rows[firstUnanchoredIndex - 1] : null;
    if (predecessor && (predecessor.onChainStatus !== 'ANCHORED' || predecessor.batchId == null)) {
      throw new Error('AUDIT_CHAIN_RECOVERY_REQUIRED: unanchored suffix has no trusted predecessor.');
    }
    const expectedFirstSeq = predecessor ? predecessor.seq! + 1 : 1;
    if (rows[firstUnanchoredIndex].seq !== expectedFirstSeq) {
      throw new Error(`AUDIT_CHAIN_RECOVERY_REQUIRED: expected unanchored seq ${expectedFirstSeq}, got ${rows[firstUnanchoredIndex].seq}.`);
    }

    let currentPrev = predecessor?.entryHash ?? GENESIS_PREV_HASH;
    let recomputed = 0;
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('blockchain_logger_chain'))`;
      await tx.$executeRaw`SELECT set_config('app.audit_recovery_authorized', 'true', true)`;
      for (let index = firstUnanchoredIndex; index < rows.length; index += 1) {
        const row = rows[index];
        if (row.onChainStatus === 'ANCHORED' && row.batchId != null) {
          throw new Error(`AUDIT_CHAIN_RECOVERY_REQUIRED: anchored row seq ${row.seq} appears after an unanchored suffix.`);
        }
        const expectedSeq = expectedFirstSeq + index - firstUnanchoredIndex;
        if (row.seq !== expectedSeq) {
          throw new Error(`AUDIT_CHAIN_RECOVERY_REQUIRED: expected seq ${expectedSeq}, got ${row.seq}.`);
        }
        const newEntryHash = this.recomputeEntryHashForRow(row, currentPrev);
        if (row.prevHash !== currentPrev || row.entryHash !== newEntryHash) {
          await tx.blockchainLogger.update({
            where: { id: row.id },
            data: { prevHash: currentPrev, entryHash: newEntryHash },
          });
          recomputed += 1;
        }
        currentPrev = newEntryHash;
      }
    });

    this.logger.log(`Re-chained ${recomputed}/${rows.length - firstUnanchoredIndex} unanchored rows.`);
    return { recomputed, total: rows.length };
  }

  async getLatestCheckpointBatchId(): Promise<number | null> {
    return this.blockchain.getLatestAuditBatchId(true);
  }

  async getCheckpointSequenceRange(batchId: number): Promise<{ fromSeq: number; toSeq: number } | null> {
    const checkpoint = await this.blockchain.getAuditCheckpoint(batchId);
    if (!checkpoint?.committed) return null;
    return { fromSeq: checkpoint.fromSeq, toSeq: checkpoint.toSeq };
  }

  private async runCycle(force = false, isRecovery = false): Promise<{ committed: boolean; batchId?: number; leafCount?: number; reason?: string }> {
    if (this.running) return { committed: false, reason: 'Chu trình neo đang chạy.' };
    this.running = true;
    try {
      if (!this.blockchain.isAuditAnchorReady()) {
        return { committed: false, reason: 'Chưa cấu hình AuditAnchor.' };
      }

      try {
        this.artifacts.assertReady();
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Audit recovery configuration is invalid.';
        return { committed: false, reason };
      }

      if (!isRecovery) {
        const chainCheck = await this.verifyFullChainBeforeAnchor();
        if (!chainCheck.ok) {
          const reason = chainCheck.reason ?? 'Không xác định được lỗi toàn vẹn chuỗi.';
          this.logger.error(`🚨 FULL CHAIN INTEGRITY FAILURE DETECTED: ${reason}. Aborting commit.`);
          await this.sendTelegramAlert('Cảnh báo giả mạo Blockchain Logger (Full-Chain)', reason, chainCheck.brokenAtSeq ?? undefined);
          return { committed: false, reason: `Kiểm tra toàn chuỗi thất bại: ${reason}` };
        }

        const anchoredCheck = await this.verifyAllAnchoredBatchesAgainstChain();
        if (!anchoredCheck.ok) {
          const reason = anchoredCheck.reason ?? 'Không xác định được lỗi batch đã neo.';
          this.logger.error(`🚨 ANCHORED BATCH INTEGRITY FAILURE DETECTED: ${reason}. Aborting commit.`);
          await this.sendTelegramAlert('Cảnh báo batch audit đã neo bị lệch', reason);
          return { committed: false, reason: `Kiểm tra batch đã neo thất bại: ${reason}` };
        }
      }

      await this.recoverPendingBatches();
      const incomplete = await this.prisma.auditBatch.findFirst({
        where: { status: { in: ['PREPARING', 'ARTIFACT_READY', 'ON_CHAIN_CONFIRMED'] } },
        orderBy: { batchId: 'asc' },
        select: { batchId: true },
      });
      if (incomplete) {
        return { committed: false, batchId: incomplete.batchId, reason: 'An incomplete batch must be resumed before creating a new batch.' };
      }

      const pending = await this.prisma.blockchainLogger.findMany({
        where: { batchId: null, seq: { not: null }, entryHash: { not: null } },
        orderBy: { seq: 'asc' },
        take: this.maxLeaves,
        select: {
          id: true,
          seq: true,
          prevHash: true,
          entryHash: true,
          actorId: true,
          action: true,
          entity: true,
          entityId: true,
          dataHash: true,
          beforeHash: true,
          afterHash: true,
          diffHash: true,
          hashVersion: true,
          fieldsChanged: true,
          createdAt: true,
        },
      });

      if (pending.length === 0) return { committed: false, reason: 'Không có bản ghi nào cần neo.' };
      void force;

      try {
        await this.validatePendingChain(pending, isRecovery);
      } catch (valErr: any) {
        const brokenSeq = pending[0]?.seq ?? 0;
        const reason = valErr.message || 'Không xác định được lỗi toàn vẹn chuỗi.';
        this.logger.error(`🚨 CHAIN INTEGRITY FAILURE DETECTED: ${reason}. Aborting commit.`);
        await this.sendTelegramAlert('Cảnh báo giả mạo Blockchain Logger (Pre-Commit)', reason, brokenSeq);
        return { committed: false, reason: `Kiểm tra chuỗi thất bại: ${reason}` };
      }

      const localMax = await this.prisma.auditBatch.aggregate({ _max: { batchId: true } });
      const onChainLatest = (await this.blockchain.getLatestAuditBatchId(true)) ?? 0;
      const batchId = Math.max(localMax._max.batchId ?? 0, onChainLatest) + 1;

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
        const logs = await this.loadRecoveryBundleRows(fromSeq, toSeq);
        artifact = await this.artifacts.createAndUpload({
          schema: 'KLTN_AUDIT_RECOVERY_BUNDLE_V1',
          batch: {
            batchId,
            merkleRoot,
            leafCount: pending.length,
            fromSeq,
            toSeq,
            algorithmVersion: this.merkleAlgorithm,
          },
          logs,
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

  private async recoverPendingBatches(): Promise<void> {
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
          const logs = await this.loadRecoveryBundleRows(batch.fromSeq, batch.toSeq);
          const artifact = await this.artifacts.createAndUpload({
            schema: 'KLTN_AUDIT_RECOVERY_BUNDLE_V1',
            batch: {
              batchId: batch.batchId,
              merkleRoot: batch.merkleRoot,
              leafCount: batch.leafCount,
              fromSeq: batch.fromSeq,
              toSeq: batch.toSeq,
              algorithmVersion: batch.algorithmVersion,
            },
            logs,
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
              const logs = await this.loadRecoveryBundleRows(batch.fromSeq!, batch.toSeq!);
              const artifact = await this.artifacts.createAndUpload({
                schema: 'KLTN_AUDIT_RECOVERY_BUNDLE_V1',
                batch: {
                  batchId: batch.batchId,
                  merkleRoot: batch.merkleRoot,
                  leafCount: batch.leafCount,
                  fromSeq: batch.fromSeq!,
                  toSeq: batch.toSeq!,
                  algorithmVersion: batch.algorithmVersion,
                },
                logs,
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
            await this.sendTelegramAlert('Audit batch recovery membership mismatch', reason, batch.fromSeq ?? undefined);
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
          await this.sendTelegramAlert('Audit batch recovery root mismatch', reason, batch.fromSeq ?? undefined);
          continue;
        }
      } catch (err) {
        this.logger.error(`Failed to recover pending audit batch ${batch.batchId}`, err);
      }
    }
  }

  private async loadRecoveryBundleRows(fromSeq: number, toSeq: number): Promise<AuditRecoveryBundleRow[]> {
    const rows = await this.prisma.blockchainLogger.findMany({
      where: { seq: { gte: fromSeq, lte: toSeq } },
      orderBy: { seq: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      eventId: row.eventId,
      seq: row.seq!,
      prevHash: row.prevHash!,
      entryHash: row.entryHash!,
      actorId: row.actorId,
      action: row.action,
      entity: row.entity,
      entityId: row.entityId,
      metadata: row.metadata,
      dataHash: row.dataHash,
      dataSalt: row.dataSalt,
      beforeJson: row.beforeJson,
      afterJson: row.afterJson,
      beforeHash: row.beforeHash,
      afterHash: row.afterHash,
      diffHash: row.diffHash,
      hashVersion: row.hashVersion,
      beforeEncrypted: row.beforeEncrypted,
      afterEncrypted: row.afterEncrypted,
      encryptionVersion: row.encryptionVersion,
      encryptionKeyId: row.encryptionKeyId,
      diffJson: row.diffJson,
      fieldsChanged: row.fieldsChanged,
      departmentId: row.departmentId,
      staffProfileId: row.staffProfileId,
      doctorProfileId: row.doctorProfileId,
      patientId: row.patientId,
      aiModelRegistryId: row.aiModelRegistryId,
      medicalConclusionId: row.medicalConclusionId,
      aiQualityId: row.aiQualityId,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  private async validateRecoverableBatchMembership(batch: {
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

  async getInclusionProof(seq: number, client: PrismaService | Prisma.TransactionClient = this.prisma): Promise<{
    seq: number;
    batchId: number;
    entryHash: string;
    proof: string[];
    merkleRoot: string;
    onChainRoot: string | null;
    verified: boolean;
  } | null> {
    const log = await client.blockchainLogger.findFirst({
      where: { seq },
      select: { seq: true, batchId: true, entryHash: true },
    });
    if (!log || log.batchId == null || !log.entryHash) return null;

    const batchLogs = await client.blockchainLogger.findMany({
      where: { batchId: log.batchId, seq: { not: null }, entryHash: { not: null } },
      orderBy: { seq: 'asc' },
      select: { seq: true, entryHash: true },
    });
    const entryHashes = batchLogs.map((l) => l.entryHash!);
    const index = batchLogs.findIndex((l) => l.seq === seq);
    if (index < 0) return null;

    const batch = await client.auditBatch.findUnique({
      where: { batchId: log.batchId },
      select: { algorithmVersion: true },
    });
    const algorithm = batch?.algorithmVersion ?? MERKLE_SHA256_STRING_V1;
    const proof = buildMerkleProofForAlgorithm(entryHashes, index, algorithm);
    const merkleRoot = computeMerkleRootForAlgorithm(entryHashes, algorithm);
    let onChainRoot = this.onChainRootCache.get(log.batchId) ?? null;
    if (!onChainRoot) {
      onChainRoot = await this.blockchain.getAuditRoot(log.batchId);
      if (onChainRoot) {
        this.onChainRootCache.set(log.batchId, onChainRoot);
      }
    }
    const verified =
      verifyMerkleProofForAlgorithm(log.entryHash, proof, merkleRoot, algorithm) &&
      onChainRoot != null &&
      rootToBytes32(merkleRoot).toLowerCase() === onChainRoot.toLowerCase();

    return { seq, batchId: log.batchId, entryHash: log.entryHash, proof, merkleRoot, onChainRoot, verified };
  }

  async getLatestVerifiedCheckpointBefore(
    targetSeq: number,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<{ batchId: number; fromSeq: number; toSeq: number; entryHash: string } | null> {
    const batch = await client.auditBatch.findFirst({
      where: { status: 'ANCHORED', toSeq: { lt: targetSeq } },
      orderBy: { toSeq: 'desc' },
      select: {
        batchId: true,
        merkleRoot: true,
        fromSeq: true,
        toSeq: true,
        leafCount: true,
        algorithmVersion: true,
      },
    });
    if (!batch || batch.fromSeq == null || batch.toSeq == null) return null;

    const checkpoint = await this.blockchain.getAuditCheckpoint(batch.batchId);
    if (
      !checkpoint?.committed ||
      checkpoint.fromSeq !== batch.fromSeq ||
      checkpoint.toSeq !== batch.toSeq ||
      checkpoint.leafCount !== batch.leafCount ||
      rootToBytes32(checkpoint.root).toLowerCase() !== rootToBytes32(batch.merkleRoot).toLowerCase()
    ) {
      throw new Error(`AUDIT_CHECKPOINT_UNVERIFIED: batch ${batch.batchId} metadata does not match blockchain.`);
    }

    const logs = await client.blockchainLogger.findMany({
      where: { seq: { gte: batch.fromSeq, lte: batch.toSeq }, entryHash: { not: null } },
      orderBy: { seq: 'asc' },
      select: { seq: true, entryHash: true },
    });
    if (logs.length !== batch.leafCount || logs[logs.length - 1]?.seq !== batch.toSeq) {
      throw new Error(`AUDIT_CHECKPOINT_UNVERIFIED: batch ${batch.batchId} local leaves are incomplete.`);
    }
    const recomputedRoot = computeMerkleRootForAlgorithm(
      logs.map((log) => log.entryHash!),
      batch.algorithmVersion ?? MERKLE_SHA256_STRING_V1,
    );
    if (rootToBytes32(recomputedRoot).toLowerCase() !== rootToBytes32(checkpoint.root).toLowerCase()) {
      throw new Error(`AUDIT_CHECKPOINT_UNVERIFIED: batch ${batch.batchId} Merkle root mismatch.`);
    }

    return {
      batchId: batch.batchId,
      fromSeq: batch.fromSeq,
      toSeq: batch.toSeq,
      entryHash: logs[logs.length - 1].entryHash!,
    };
  }

  private async verifyFullChainBeforeAnchor(): Promise<{ ok: boolean; brokenAtSeq: number | null; reason: string | null }> {
    try {
      const gucRows = await this.prisma.$queryRaw<Array<{ value: string }>>`
        SELECT current_setting('app.audit_recovery_authorized', true) AS value
      `;
      if (gucRows[0]?.value === 'true') {
        this.logger.warn('Recovery-authorized GUC is active: skipping strict full-chain validation.');
        return { ok: true, brokenAtSeq: null, reason: null };
      }
    } catch (error) {
      this.logger.warn('Failed to read app.audit_recovery_authorized GUC; running strict validation.', error);
    }

    const rows = await this.prisma.blockchainLogger.findMany({
      where: { seq: { not: null } },
      orderBy: { seq: 'asc' },
      select: {
        seq: true,
        prevHash: true,
        entryHash: true,
        actorId: true,
        action: true,
        entity: true,
        entityId: true,
        dataHash: true,
        beforeHash: true,
        afterHash: true,
        diffHash: true,
        hashVersion: true,
        fieldsChanged: true,
        createdAt: true,
      },
    });

    let expectedPrev = GENESIS_PREV_HASH;
    let expectedSeq = 1;
    for (const row of rows) {
      if (row.seq !== expectedSeq) {
        return { ok: false, brokenAtSeq: row.seq, reason: `Đứt quãng số thứ tự: mong đợi ${expectedSeq}, nhận được ${row.seq}` };
      }
      if (row.prevHash !== expectedPrev) {
        return { ok: false, brokenAtSeq: row.seq, reason: 'prevHash không khớp entryHash liền trước' };
      }
      const recomputed = this.recomputeEntryHashForRow(row, row.prevHash ?? GENESIS_PREV_HASH);
      if (recomputed !== row.entryHash) {
        return { ok: false, brokenAtSeq: row.seq, reason: 'entryHash không khớp; nội dung bản ghi có thể đã bị sửa' };
      }
      expectedPrev = row.entryHash!;
      expectedSeq += 1;
    }

    return { ok: true, brokenAtSeq: null, reason: null };
  }

  async verifyAllAnchoredBatchesAgainstChain(): Promise<{ ok: boolean; checked: number; failedBatchId: number | null; reason: string | null }> {
    const batches = await this.prisma.auditBatch.findMany({
      where: { status: 'ANCHORED' },
      orderBy: { batchId: 'asc' },
      select: { batchId: true, merkleRoot: true, fromSeq: true, toSeq: true, algorithmVersion: true },
    });

    for (const batch of batches) {
      if (batch.fromSeq == null || batch.toSeq == null) {
        return { ok: false, checked: 0, failedBatchId: batch.batchId, reason: `Batch ${batch.batchId} thiếu fromSeq/toSeq` };
      }

      const logs = await this.prisma.blockchainLogger.findMany({
        where: { seq: { gte: batch.fromSeq, lte: batch.toSeq }, entryHash: { not: null } },
        orderBy: { seq: 'asc' },
        select: { seq: true, entryHash: true },
      });
      if (logs.length === 0) {
        return { ok: false, checked: 0, failedBatchId: batch.batchId, reason: `Batch ${batch.batchId} không có log để xác minh` };
      }

      const recomputedRoot = computeMerkleRootForAlgorithm(
        logs.map((log) => log.entryHash!),
        batch.algorithmVersion ?? MERKLE_SHA256_STRING_V1,
      );
      if (recomputedRoot !== batch.merkleRoot) {
        return { ok: false, checked: 0, failedBatchId: batch.batchId, reason: `Batch ${batch.batchId} root DB không khớp root tính lại` };
      }

      const onChainRoot = await this.blockchain.getAuditRoot(batch.batchId);
      if (!onChainRoot) {
        return { ok: false, checked: 0, failedBatchId: batch.batchId, reason: `Batch ${batch.batchId} không tồn tại on-chain` };
      }
      if (rootToBytes32(recomputedRoot).toLowerCase() !== onChainRoot.toLowerCase()) {
        return { ok: false, checked: 0, failedBatchId: batch.batchId, reason: `Batch ${batch.batchId} root on-chain không khớp` };
      }
    }

    return { ok: true, checked: batches.length, failedBatchId: null, reason: null };
  }

  async verifySingleAnchoredBatch(batchId: number): Promise<{ ok: boolean; reason: string | null }> {
    const batch = await this.prisma.auditBatch.findUnique({
      where: { batchId },
      select: { batchId: true, merkleRoot: true, fromSeq: true, toSeq: true, algorithmVersion: true, status: true },
    });
    if (!batch || batch.status !== 'ANCHORED') {
      return { ok: false, reason: `Batch ${batchId} không tồn tại hoặc chưa neo` };
    }
    if (batch.fromSeq == null || batch.toSeq == null) {
      return { ok: false, reason: `Batch ${batchId} thiếu fromSeq/toSeq` };
    }

    const logs = await this.prisma.blockchainLogger.findMany({
      where: { seq: { gte: batch.fromSeq, lte: batch.toSeq }, entryHash: { not: null } },
      orderBy: { seq: 'asc' },
      select: { seq: true, entryHash: true },
    });
    if (logs.length === 0) {
      return { ok: false, reason: `Batch ${batchId} không có log để xác minh` };
    }

    const recomputedRoot = computeMerkleRootForAlgorithm(
      logs.map((log) => log.entryHash),
      batch.algorithmVersion ?? MERKLE_SHA256_STRING_V1,
    );
    if (recomputedRoot !== batch.merkleRoot) {
      return { ok: false, reason: `Batch ${batchId} root DB không khớp root tính lại` };
    }

    const onChainRoot = await this.blockchain.getAuditRoot(batchId);
    if (!onChainRoot) {
      return { ok: false, reason: `Batch ${batchId} không tồn tại on-chain` };
    }
    if (rootToBytes32(recomputedRoot).toLowerCase() !== onChainRoot.toLowerCase()) {
      return { ok: false, reason: `Batch ${batchId} root on-chain không khớp` };
    }

    return { ok: true, reason: null };
  }

  private async validatePendingChain(pending: any[], isRecovery = false): Promise<void> {
    if (pending.length === 0) return;

    let expectedPrevHash = pending[0].prevHash ?? GENESIS_PREV_HASH;
    if (!isRecovery && pending[0].seq > 1) {
      const precedingLog = await this.prisma.blockchainLogger.findFirst({
        where: { seq: pending[0].seq - 1 },
        select: { entryHash: true },
      });
      if (!precedingLog) {
        throw new Error(`Đứt quãng số thứ tự: không tìm thấy bản ghi liền trước seq ${pending[0].seq}`);
      }
      expectedPrevHash = precedingLog.entryHash!;
    }

    let expectedSeq = pending[0].seq!;
    for (const log of pending) {
      if (log.seq !== expectedSeq) {
        throw new Error(`Đứt quãng số thứ tự: mong đợi ${expectedSeq}, nhận được ${log.seq}`);
      }
      if (log.prevHash !== expectedPrevHash) {
        throw new Error(`prevHash không khớp: mong đợi ${expectedPrevHash}, nhận được ${log.prevHash}`);
      }
      const recomputed = this.recomputeEntryHashForRow(log, log.prevHash ?? GENESIS_PREV_HASH);
      if (recomputed !== log.entryHash) {
        throw new Error(`entryHash không khớp: tính lại ${recomputed}, nhận được ${log.entryHash}`);
      }
      expectedPrevHash = log.entryHash!;
      expectedSeq += 1;
    }
  }

  private recomputeEntryHashForRow(
    row: {
      seq: number | null;
      actorId: string | null;
      action: string;
      entity: string;
      entityId: string | null;
      dataHash: string | null;
      beforeHash?: string | null;
      afterHash?: string | null;
      diffHash?: string | null;
      hashVersion?: string | null;
      fieldsChanged?: unknown;
      createdAt: Date;
    },
    prevHash: string,
  ): string {
    if (row.hashVersion === AUDIT_ENTRY_V2 || !row.hashVersion) {
      if (!row.seq || !row.dataHash || !row.beforeHash || !row.afterHash || !row.diffHash) {
        throw new Error(`V2 audit row seq ${row.seq ?? 'unknown'} thiếu component hash bắt buộc.`);
      }
      return computeEntryHashV2({
        seq: row.seq,
        prevHash,
        entity: row.entity,
        entityId: row.entityId,
        action: row.action,
        actorId: row.actorId,
        beforeHash: row.beforeHash,
        afterHash: row.afterHash,
        diffHash: row.diffHash,
        dataHash: row.dataHash,
        createdAtIso: row.createdAt.toISOString(),
      });
    }

    throw new Error(`Unsupported audit hashVersion at seq ${row.seq ?? 'unknown'}: ${row.hashVersion}`);
  }

  async sendTelegramAlert(title: string, details: string, brokenSeq?: number): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const phone = process.env.ADMIN_PHONE_NUMBER ?? 'N/A';
    if (!token || !chatId || token === 'your_telegram_bot_token_here') {
      this.logger.warn('Telegram alerts are not configured or still have default placeholders. Skipping alert.');
      return;
    }
    const message = `🚨 [CẢNH BÁO BẢO MẬT] ${title.toUpperCase()}\n\n` +
      `${details}\n\n` +
      `• SĐT Admin: ${phone}\n` +
      (brokenSeq !== undefined ? `• Sequence bị lỗi: ${brokenSeq}\n` : '') +
      `• Thời gian: ${new Date().toLocaleString('vi-VN')}\n\n` +
      `⚠️ Yêu cầu Quản trị viên kiểm tra tính toàn vẹn hệ thống ngay lập tức!`;
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: message }),
      });
      if (!res.ok) {
        this.logger.error(`Failed to send Telegram alert: ${res.statusText}`);
      } else {
        this.logger.log('Telegram security alert sent successfully.');
      }
    } catch (err) {
      this.logger.error('Failed to send Telegram alert via fetch', err);
    }
  }
}

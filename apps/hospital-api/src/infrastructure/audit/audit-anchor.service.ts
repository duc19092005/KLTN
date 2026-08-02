import { Injectable, Logger, OnModuleDestroy, OnModuleInit, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import {
  MERKLE_SHA256_STRING_V1,
  MERKLE_SHA256_BYTES32_V2,
  buildMerkleProofForAlgorithm,
  computeMerkleRootForAlgorithm,
  rootToBytes32,
  verifyMerkleProofForAlgorithm,
} from './merkle.util';
import { AUDIT_ENTRY_V2, computeEntryHash, computeEntryHashV2, GENESIS_PREV_HASH } from './audit-hash.util';
import { AuditArtifactService, AuditRecoveryBundleRow } from './audit-artifact.service';

/**
 * AuditAnchorService periodically seals a batch of not-yet-anchored audit logs, builds a Merkle
 * tree over their entryHashes, uploads an encrypted recovery artifact, and commits a checkpoint.
 *
 * Cost model: one transaction per batch, independent of batch size. 10 logs or 10,000 logs both
 * cost a single ~80-120k-gas commit storing one 32-byte root, so per-log gas falls as volume
 * rises. Individual logs are never written on-chain.
 *
 * Trigger conditions (whichever comes first):
 *  - time:    every AUDIT_BATCH_INTERVAL_MS (default 5 min) -> bounds the "soft window"
 *  - size:    when >= AUDIT_BATCH_MAX_LEAVES unanchored logs accumulate (default 500)
 *  - explicit: anchorNow() for Tier-A events that must be sealed immediately
 *
 * A batch row is created PENDING, flipped to ANCHORED once the tx confirms (logs updated with
 * batchId/txHash), or marked FAILED if the commit fails (logs stay unanchored and retry next
 * cycle). Only anchoring metadata is mutated on log rows, which the append-only trigger permits.
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
    private readonly artifacts: AuditArtifactService,
  ) {}

  onModuleInit() {
    // Guarantee the append-only trigger exists even when the schema was synced via
    // `prisma db push` (which does not apply raw-SQL migrations / triggers). Idempotent.
    if (process.env.SKIP_PRISMA_CONNECT !== 'true') {
      this.ensureAppendOnlyTrigger().catch((err) =>
        this.logger.error('Failed to ensure append-only trigger', err),
      );
    }

    if (process.env.AUDIT_BATCH_DISABLED === 'true') {
      this.logger.warn('Audit batch anchoring disabled via AUDIT_BATCH_DISABLED.');
      return;
    }
    // Stagger the first run so it doesn't fire during boot.
    this.timer = setInterval(() => {
      this.runCycle().catch((err) => this.logger.error('Audit batch cycle failed', err));
    }, this.intervalMs);
    this.logger.log(`Audit batch anchoring scheduled every ${this.intervalMs}ms (max ${this.maxLeaves} leaves/batch).`);
  }

  async onApplicationBootstrap() {
    // Automatically trigger Genesis Anchor if the blockchain has zero batches.
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
        this.logger.log('🚀 [Genesis Anchor] Detected empty blockchain state. Checking for seed/initial logs...');

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
        } else {
          this.logger.log('🚀 [Genesis Anchor] No pending logs to anchor.');
        }
      }
    } catch (err) {
      this.logger.error('Failed to execute Genesis Anchor on bootstrap:', err);
    }
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * Create (or refresh) the BEFORE UPDATE/DELETE trigger that makes BlockchainLogger content
   * immutable: DELETE is always rejected, and UPDATE may only touch anchoring metadata
   * (onChainStatus/txHash/blockNumber/batchId). Runs on every boot; CREATE OR REPLACE +
   * DROP IF EXISTS make it safe to re-run. Mirrors the SQL in the dedicated migration so the
   * protection holds under both `prisma migrate` and `prisma db push` deployment paths.
   */
  private async ensureAppendOnlyTrigger(): Promise<void> {
    await this.prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION "blockchain_logger_append_only"()
      RETURNS TRIGGER AS $$
      BEGIN
        IF current_setting('app.audit_recovery_authorized', true) = 'true' THEN
          IF (TG_OP = 'DELETE') THEN RETURN OLD; END IF;
          RETURN NEW;
        END IF;
        IF (TG_OP = 'DELETE') THEN
          RAISE EXCEPTION 'BlockchainLogger is append-only: DELETE is forbidden (seq=%).', OLD."seq";
        END IF;
        IF (TG_OP = 'UPDATE') THEN
          IF NEW."id"         IS DISTINCT FROM OLD."id"         OR
             NEW."eventId"    IS DISTINCT FROM OLD."eventId"    OR
             NEW."actorId"    IS DISTINCT FROM OLD."actorId"    OR
             NEW."action"     IS DISTINCT FROM OLD."action"     OR
             NEW."entity"     IS DISTINCT FROM OLD."entity"     OR
             NEW."entityId"   IS DISTINCT FROM OLD."entityId"   OR
             NEW."metadata"   IS DISTINCT FROM OLD."metadata"   OR
             NEW."dataHash"   IS DISTINCT FROM OLD."dataHash"   OR
             NEW."dataSalt"   IS DISTINCT FROM OLD."dataSalt"   OR
             NEW."beforeJson"         IS DISTINCT FROM OLD."beforeJson"         OR
             NEW."afterJson"          IS DISTINCT FROM OLD."afterJson"          OR
             NEW."beforeHash"         IS DISTINCT FROM OLD."beforeHash"         OR
             NEW."afterHash"          IS DISTINCT FROM OLD."afterHash"          OR
             NEW."diffHash"           IS DISTINCT FROM OLD."diffHash"           OR
             NEW."hashVersion"        IS DISTINCT FROM OLD."hashVersion"        OR
             NEW."beforeEncrypted"    IS DISTINCT FROM OLD."beforeEncrypted"    OR
             NEW."afterEncrypted"     IS DISTINCT FROM OLD."afterEncrypted"     OR
             NEW."encryptionVersion"  IS DISTINCT FROM OLD."encryptionVersion"  OR
             NEW."encryptionKeyId"    IS DISTINCT FROM OLD."encryptionKeyId"    OR
             NEW."diffJson"           IS DISTINCT FROM OLD."diffJson"           OR
             NEW."fieldsChanged"      IS DISTINCT FROM OLD."fieldsChanged"      OR
             NEW."departmentId"       IS DISTINCT FROM OLD."departmentId"       OR
             NEW."staffProfileId"     IS DISTINCT FROM OLD."staffProfileId"     OR
             NEW."doctorProfileId"    IS DISTINCT FROM OLD."doctorProfileId"    OR
             NEW."patientId"          IS DISTINCT FROM OLD."patientId"          OR
             NEW."aiModelRegistryId"  IS DISTINCT FROM OLD."aiModelRegistryId"  OR
             NEW."medicalConclusionId" IS DISTINCT FROM OLD."medicalConclusionId" OR
             NEW."aiQualityId"        IS DISTINCT FROM OLD."aiQualityId"        OR
             NEW."seq"                IS DISTINCT FROM OLD."seq"                OR
             NEW."prevHash"           IS DISTINCT FROM OLD."prevHash"           OR
             NEW."entryHash"          IS DISTINCT FROM OLD."entryHash"          OR
             NEW."createdAt"          IS DISTINCT FROM OLD."createdAt"
          THEN
            RAISE EXCEPTION 'BlockchainLogger is append-only: content columns are immutable (seq=%).', OLD."seq";
          END IF;

          IF OLD."batchId" IS NOT NULL AND NEW."batchId" IS DISTINCT FROM OLD."batchId" THEN
            RAISE EXCEPTION 'BlockchainLogger anchoring metadata is immutable: batchId already set (seq=%).', OLD."seq";
          END IF;
          IF OLD."txHash" IS NOT NULL AND NEW."txHash" IS DISTINCT FROM OLD."txHash" THEN
            RAISE EXCEPTION 'BlockchainLogger anchoring metadata is immutable: txHash already set (seq=%).', OLD."seq";
          END IF;
          IF OLD."blockNumber" IS NOT NULL AND NEW."blockNumber" IS DISTINCT FROM OLD."blockNumber" THEN
            RAISE EXCEPTION 'BlockchainLogger anchoring metadata is immutable: blockNumber already set (seq=%).', OLD."seq";
          END IF;
          IF OLD."onChainStatus" = 'ANCHORED' AND NEW."onChainStatus" IS DISTINCT FROM OLD."onChainStatus" THEN
            RAISE EXCEPTION 'BlockchainLogger anchored status is immutable (seq=%).', OLD."seq";
          END IF;
          IF OLD."onChainStatus" IS DISTINCT FROM NEW."onChainStatus"
             AND NOT (OLD."onChainStatus" = 'PENDING' AND NEW."onChainStatus" IN ('ANCHORED', 'FAILED', 'UNANCHORED'))
          THEN
            RAISE EXCEPTION 'BlockchainLogger invalid onChainStatus transition from % to % (seq=%).', OLD."onChainStatus", NEW."onChainStatus", OLD."seq";
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await this.prisma.$executeRawUnsafe(
      `DROP TRIGGER IF EXISTS "trg_blockchain_logger_append_only" ON "BlockchainLogger";`,
    );
    await this.prisma.$executeRawUnsafe(`
      CREATE TRIGGER "trg_blockchain_logger_append_only"
        BEFORE UPDATE OR DELETE ON "BlockchainLogger"
        FOR EACH ROW EXECUTE FUNCTION "blockchain_logger_append_only"();
    `);
    this.logger.log('Append-only trigger on BlockchainLogger ensured.');
  }

  /** Force an immediate batch seal+commit (e.g. after a Tier-A clinical event). */
  async anchorNow(): Promise<{ committed: boolean; batchId?: number; leafCount?: number; reason?: string }> {
    return this.runCycle(true);
  }

  /**
   * Seal pending logs into a batch and commit the Merkle root on-chain. Guarded so only one
   * cycle runs at a time. When `force` is false the size threshold is informational only; the
   * timer always attempts to drain whatever is pending.
   */
  private async runCycle(force = false): Promise<{ committed: boolean; batchId?: number; leafCount?: number; reason?: string }> {
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

      await this.recoverPendingBatches();
      const incomplete = await this.prisma.auditBatch.findFirst({
        where: { status: { in: ['PREPARING', 'ARTIFACT_READY', 'ON_CHAIN_CONFIRMED'] } },
        orderBy: { batchId: 'asc' },
        select: { batchId: true },
      });
      if (incomplete) {
        return { committed: false, batchId: incomplete.batchId, reason: 'An incomplete batch must be resumed before creating a new batch.' };
      }

      // Pull unanchored, chained logs in seq order, capped at maxLeaves per batch.
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
      void force; // size gating is advisory; we always drain when invoked

      // Validate the chain of pending logs before building Merkle root
      try {
        await this.validatePendingChain(pending);
      } catch (valErr: any) {
        const brokenSeq = pending[0]?.seq ?? 0;
        const reason = valErr.message || 'Không xác định được lỗi toàn vẹn chuỗi.';
        this.logger.error(`🚨 CHAIN INTEGRITY FAILURE DETECTED: ${reason}. Aborting commit.`);
        await this.sendTelegramAlert('Cảnh báo giả mạo Blockchain Logger (Pre-Commit)', reason, brokenSeq);
        return { committed: false, reason: `Kiểm tra chuỗi thất bại: ${reason}` };
      }

      // Allocate a monotonic batchId, reconciling local state with the on-chain counter so we
      // never reuse an id the contract already has (it rejects duplicates).
      const localMax = await this.prisma.auditBatch.aggregate({ _max: { batchId: true } });
      const onChainLatest = (await this.blockchain.getLatestAuditBatchId()) ?? 0;
      const batchId = Math.max(localMax._max.batchId ?? 0, onChainLatest) + 1;

      const entryHashes = pending.map((p) => p.entryHash!);
      const merkleRoot = computeMerkleRootForAlgorithm(entryHashes, this.merkleAlgorithm);
      const fromSeq = pending[0].seq!;
      const toSeq = pending[pending.length - 1].seq!;

      // Record the batch as PENDING before the tx so a crash mid-commit is recoverable.
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
        artifact.artifactHash,
        artifact.artifactUri,
      );

      if (!res.success) {
        await this.prisma.auditBatch.update({
          where: { batchId },
          data: { status: 'ARTIFACT_READY', error: (res as any).error ?? 'Blockchain checkpoint commit failed.' },
        });
        this.logger.error(`Batch ${batchId} commit failed: ${(res as any).error}`);
        return { committed: false, batchId, reason: (res as any).error };
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

      // Confirmed: mark the batch ANCHORED and stamp every member log (metadata-only update,
      // permitted by the append-only trigger).
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
    const pendingBatches = await this.prisma.auditBatch.findMany({
      where: { status: { in: ['PENDING', 'PREPARING', 'ARTIFACT_READY', 'ON_CHAIN_CONFIRMED'] } },
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

    if (pendingBatches.length === 0) return;

    this.logger.warn(`Found ${pendingBatches.length} pending audit batch(es). Starting recovery check...`);
    for (const batch of pendingBatches) {
      try {
        if (batch.status === 'PENDING') {
          await this.prisma.auditBatch.update({
            where: { batchId: batch.batchId },
            data: { status: 'PREPARING' },
          });
          continue;
        }

        if (batch.status === 'PREPARING') {
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
          continue;
        }

        const checkpoint = await this.blockchain.getAuditCheckpoint(batch.batchId);
        const localRootBytes32 = rootToBytes32(batch.merkleRoot).toLowerCase();
        const onChainRoot = checkpoint?.root?.toLowerCase();

        if (batch.status === 'ARTIFACT_READY' && !checkpoint?.committed) {
          if (!batch.artifactHash || !batch.artifactUri) throw new Error('Prepared batch is missing artifact metadata.');
          const result = await this.blockchain.commitAuditCheckpoint(
            batch.batchId,
            localRootBytes32,
            batch.leafCount,
            batch.artifactHash,
            batch.artifactUri,
          );
          if (!result.success) {
            const reason = 'error' in result ? result.error : 'Blockchain checkpoint commit failed.';
            await this.prisma.auditBatch.update({ where: { batchId: batch.batchId }, data: { error: reason } });
            continue;
          }
          await this.prisma.auditBatch.update({
            where: { batchId: batch.batchId },
            data: {
              status: 'ON_CHAIN_CONFIRMED',
              txHash: result.txHash,
              blockNumber: result.blockNumber,
              anchoredAt: new Date(),
              error: null,
            },
          });
          continue;
        }

        if (checkpoint?.committed && onChainRoot === localRootBytes32) {
          if (!batch.artifactHash || !batch.artifactUri
            || checkpoint.artifactHash.toLowerCase() !== batch.artifactHash.toLowerCase()
            || checkpoint.artifactUri !== batch.artifactUri
            || checkpoint.leafCount !== batch.leafCount) {
            throw new Error(`Pending batch ${batch.batchId} artifact metadata does not match its on-chain checkpoint.`);
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
                seq: { gte: batch.fromSeq!, lte: batch.toSeq! },
                batchId: null,
              },
              data: { batchId: batch.batchId, onChainStatus: 'ANCHORED' },
            }),
          ]);
          this.logger.warn(`Recovered audit batch ${batch.batchId} from on-chain checkpoint.`);
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

  /**
   * Build a Merkle inclusion proof for a single log within its committed batch, so an external
   * party can verify the log existed at anchor time without seeing the other logs.
   */
  async getInclusionProof(seq: number): Promise<{
    seq: number;
    batchId: number;
    entryHash: string;
    proof: string[];
    merkleRoot: string;
    onChainRoot: string | null;
    verified: boolean;
  } | null> {
    const log = await this.prisma.blockchainLogger.findFirst({
      where: { seq },
      select: { seq: true, batchId: true, entryHash: true },
    });
    if (!log || log.batchId == null || !log.entryHash) return null;

    const batchLogs = await this.prisma.blockchainLogger.findMany({
      where: { batchId: log.batchId, seq: { not: null }, entryHash: { not: null } },
      orderBy: { seq: 'asc' },
      select: { seq: true, entryHash: true },
    });
    const entryHashes = batchLogs.map((l) => l.entryHash!);
    const index = batchLogs.findIndex((l) => l.seq === seq);
    if (index < 0) return null;

    const batch = await this.prisma.auditBatch.findUnique({
      where: { batchId: log.batchId },
      select: { algorithmVersion: true },
    });
    const algorithm = batch?.algorithmVersion ?? MERKLE_SHA256_STRING_V1;
    const proof = buildMerkleProofForAlgorithm(entryHashes, index, algorithm);
    const merkleRoot = computeMerkleRootForAlgorithm(entryHashes, algorithm);
    const onChainRoot = await this.blockchain.getAuditRoot(log.batchId);
    const verified =
      verifyMerkleProofForAlgorithm(log.entryHash, proof, merkleRoot, algorithm) &&
      onChainRoot != null &&
      rootToBytes32(merkleRoot).toLowerCase() === onChainRoot.toLowerCase();

    return { seq, batchId: log.batchId, entryHash: log.entryHash, proof, merkleRoot, onChainRoot, verified };
  }

  private async verifyFullChainBeforeAnchor(): Promise<{ ok: boolean; brokenAtSeq: number | null; reason: string | null }> {
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

  private async validatePendingChain(pending: any[]): Promise<void> {
    if (pending.length === 0) return;

    let expectedPrevHash = GENESIS_PREV_HASH;
    if (pending[0].seq > 1) {
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
    if (row.hashVersion === AUDIT_ENTRY_V2) {
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

    if (row.hashVersion) {
      throw new Error(`Unsupported audit hashVersion at seq ${row.seq ?? 'unknown'}: ${row.hashVersion}`);
    }

    return computeEntryHash(
      {
        seq: row.seq!,
        actorId: row.actorId,
        action: row.action,
        entity: row.entity,
        entityId: row.entityId,
        dataHash: row.dataHash,
        createdAtIso: row.createdAt.toISOString(),
      },
      prevHash,
    );
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

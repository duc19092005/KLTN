import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { AUDIT_ENTRY_V2, computeEntryHashV2, GENESIS_PREV_HASH } from '../crypto/audit-hash.util';
import { computeMerkleRootForAlgorithm, MERKLE_SHA256_STRING_V1, rootToBytes32 } from '../crypto/merkle.util';
import { AuditTelegramAlertService } from './audit-telegram-alert.service';

@Injectable()
export class AuditChainVerifier {
  private readonly logger = new Logger(AuditChainVerifier.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchain: BlockchainService,
    private readonly alertService: AuditTelegramAlertService,
  ) {}

  recomputeEntryHashForRow(
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

  async verifyFullChainBeforeAnchor(): Promise<{ ok: boolean; brokenAtSeq: number | null; reason: string | null }> {
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
}
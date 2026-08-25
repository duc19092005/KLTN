import { Injectable, forwardRef, Inject } from '@nestjs/common';
import { BlockchainLogger, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  computeEntryHashV2,
  computeBeforeHashV2,
  computeAfterHashV2,
  computeDiffHashV2,
  computeDataHashV2,
  computeRecordHash,
  generateSalt,
  GENESIS_PREV_HASH,
  AUDIT_ENTRY_V2,
  canonicalize,
} from '../crypto/audit-hash.util';
import { sanitizeAuditPayload } from '../crypto/audit-sanitizer.util';
import { buildAuditDiff } from '../crypto/audit-diff.util';
import {
  AUDIT_ENCRYPTION_VERSION,
  buildAuditEncryptionAad,
  encryptAuditSnapshot,
} from '../crypto/audit-encryption.util';
import { AuditAnchorService } from '../anchoring/audit-anchor.service';
import { verifyAuditRowLight } from './audit-verification.util';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'ACCESS' | 'SECURITY';

const FK_FIELD: Record<string, string> = {
  Department: 'departmentId',
  StaffProfile: 'staffProfileId',
  DoctorProfile: 'doctorProfileId',
  Patient: 'patientId',
  AiModelRegistry: 'aiModelRegistryId',
  MedicalConclusion: 'medicalConclusionId',
  Visit: 'visitId',
  MedicalOrder: 'medicalOrderId',
  MedicalResult: 'medicalResultId',
  AiQuality: 'aiQualityId',
};

/**
 * AuditLoggerService is the centralized write/read API for the tamper-evident
 * BlockchainLogger table.
 */
@Injectable()
export class AuditLoggerService {
  private chainMutex: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => AuditAnchorService))
    private readonly anchor: AuditAnchorService,
  ) {}

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.chainMutex.then(fn, fn);
    this.chainMutex = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  /**
   * Persist one audit entry using the canonical Blockchain Audit V2 format.
   */
  async record(
    params: {
      entity: string;
      entityId: string;
      action: AuditAction | string;
      actorId?: string | null;
      dataHash?: string | null;
      dataSalt?: string | null;
      before?: unknown;
      after?: unknown;
      onChainStatus?: string;
      txHash?: string | null;
      blockNumber?: number | null;
      metadata?: unknown;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const v2Params = {
      entity: params.entity,
      entityId: params.entityId,
      action: params.action,
      actorId: params.actorId,
      before: this.toAuditSnapshot(params.before),
      after: this.toAuditSnapshot(params.after),
      onChainStatus: params.onChainStatus,
      txHash: params.txHash,
      blockNumber: params.blockNumber,
      metadata: params.metadata,
    };
    if (tx) return this.appendRecordV2(v2Params, tx);
    const row = await this.enqueue(() => this.prisma.$transaction((transaction) => this.appendRecordV2(v2Params, transaction)));
    await this.anchorTierA(row);
    return row;
  }

  async recordV2(
    params: {
      entity: string;
      entityId: string;
      action: AuditAction | string;
      actorId?: string | null;
      before?: Record<string, unknown> | null;
      after?: Record<string, unknown> | null;
      onChainStatus?: string;
      txHash?: string | null;
      blockNumber?: number | null;
      metadata?: unknown;
    },
    tx?: Prisma.TransactionClient,
  ) {
    if (tx) return this.appendRecordV2(params, tx);
    const row = await this.enqueue(() => this.prisma.$transaction((transaction) => this.appendRecordV2(params, transaction)));
    await this.anchorTierA(row);
    return row;
  }

  /**
   * Compute a fresh random salt and SHA-256 integrity hash for an entity snapshot.
   */
  hashSnapshot(snapshot: Record<string, unknown> | null | undefined): { hash: string; salt: string } {
    const salt = generateSalt();
    const hash = computeRecordHash(snapshot, salt);
    return { hash, salt };
  }

  /**
   * Recompute the SHA-256 integrity hash for an entity snapshot given its existing salt.
   */
  recompute(snapshot: Record<string, unknown> | null | undefined, salt: string): string {
    return computeRecordHash(snapshot, salt);
  }

  private toAuditSnapshot(value: unknown): Record<string, unknown> | null {
    if (value == null) return null;
    if (value instanceof Date) return { value: value.toISOString() };
    if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
    return { value };
  }

  private async appendRecordV2(
    params: {
      entity: string;
      entityId: string;
      action: AuditAction | string;
      actorId?: string | null;
      before?: Record<string, unknown> | null;
      after?: Record<string, unknown> | null;
      onChainStatus?: string;
      txHash?: string | null;
      blockNumber?: number | null;
      metadata?: unknown;
    },
    client: Prisma.TransactionClient,
  ) {
    await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('blockchain_logger_chain'))`;

    const tail = await client.blockchainLogger.findFirst({
      where: { seq: { not: null } },
      orderBy: { seq: 'desc' },
      select: { seq: true, entryHash: true },
    });
    const highWater = await this.getTrustedSequenceHighWater(client);
    if (tail == null && highWater > 0) {
      throw new Error(`AUDIT_CHAIN_RECOVERY_REQUIRED: local audit history is empty but blockchain is anchored through seq ${highWater}.`);
    }
    if ((tail?.seq ?? 0) < highWater) {
      throw new Error(`AUDIT_CHAIN_RECOVERY_REQUIRED: local chain ends at seq ${tail?.seq ?? 0}, below anchored seq ${highWater}.`);
    }
    const seq = Math.max(tail?.seq ?? 0, highWater) + 1;
    const eventId = randomUUID();
    const prevHash = tail?.entryHash ?? GENESIS_PREV_HASH;
    const createdAt = new Date();
    const createdAtIso = createdAt.toISOString();
    const rawBefore = params.before ?? null;
    const rawAfter = params.after ?? null;
    const diffJson = buildAuditDiff(params.before ?? null, params.after ?? null);
    const fieldsChanged = diffJson.fieldsChanged;

    const beforeHash = computeBeforeHashV2(params.entity, params.entityId, rawBefore);
    const afterHash = computeAfterHashV2(params.entity, params.entityId, rawAfter);
    const diffHash = computeDiffHashV2(diffJson);
    const dataHash = computeDataHashV2({
      entity: params.entity,
      entityId: params.entityId,
      action: params.action,
      beforeHash,
      afterHash,
      diffHash,
      fieldsChanged,
    });
    const entryHash = computeEntryHashV2({
      seq,
      prevHash,
      entity: params.entity,
      entityId: params.entityId,
      action: params.action,
      actorId: params.actorId ?? null,
      beforeHash,
      afterHash,
      diffHash,
      dataHash,
      createdAtIso,
    });
    const aad = buildAuditEncryptionAad({
      seq,
      entity: params.entity,
      entityId: params.entityId,
      action: params.action,
      createdAtIso,
    });
    const beforeEncrypted = encryptAuditSnapshot(canonicalize(rawBefore), aad);
    const afterEncrypted = encryptAuditSnapshot(canonicalize(rawAfter), aad);

    const fkField = FK_FIELD[params.entity];
    const data: Record<string, any> = {
      entity: params.entity,
      eventId,
      entityId: params.entityId,
      action: params.action,
      actorId: params.actorId ?? null,
      dataHash,
      dataSalt: null,
      beforeJson: sanitizeAuditPayload(params.entity, rawBefore) as any,
      afterJson: sanitizeAuditPayload(params.entity, rawAfter) as any,
      beforeHash,
      afterHash,
      diffHash,
      hashVersion: AUDIT_ENTRY_V2,
      beforeEncrypted: beforeEncrypted as any,
      afterEncrypted: afterEncrypted as any,
      encryptionVersion: AUDIT_ENCRYPTION_VERSION,
      encryptionKeyId: beforeEncrypted.keyId,
      diffJson: diffJson as any,
      fieldsChanged: fieldsChanged as any,
      onChainStatus: params.onChainStatus ?? 'PENDING',
      txHash: params.txHash ?? null,
      blockNumber: params.blockNumber ?? null,
      metadata: sanitizeAuditPayload(params.entity, params.metadata) as any,
      seq,
      prevHash,
      entryHash,
      createdAt,
    };
    if (fkField) data[fkField] = params.entityId;

    return client.blockchainLogger.create({
      data: data as Prisma.BlockchainLoggerUncheckedCreateInput,
    });
  }

  private async getTrustedSequenceHighWater(client: Prisma.TransactionClient): Promise<number> {
    const local = client.auditBatch?.aggregate
      ? await client.auditBatch.aggregate({ where: { status: 'ANCHORED' }, _max: { toSeq: true } })
      : { _max: { toSeq: null } };
    const latestBatchId = (await this.anchor.getLatestCheckpointBatchId()) ?? 0;
    if (latestBatchId <= 0) return local._max.toSeq ?? 0;
    const checkpoint = await this.anchor.getCheckpointSequenceRange(latestBatchId);
    return Math.max(local._max.toSeq ?? 0, checkpoint?.toSeq ?? 0);
  }

  private auditTier(entity: string, action: string): 'A' | 'B' {
    if (entity === 'MedicalConclusion' || action === 'AUDIT_RECOVERY_EXECUTED' || action === 'AUDIT_ENTITY_RECOVERED' || action.includes('SECURITY')) {
      return 'A';
    }
    return 'B';
  }

  private async anchorTierA(row: BlockchainLogger): Promise<void> {
    if (this.auditTier(row.entity, row.action) !== 'A') return;
    try {
      await this.anchor.anchorNow();
    } catch {
      // The durable audit row remains pending and the periodic batch worker retries it.
    }
  }

  /** List change history for an entity (optionally a specific record), newest first. */
  history(entity: string, entityId?: string) {
    return this.prisma.blockchainLogger.findMany({
      where: { entity, ...(entityId ? { entityId } : {}) },
      orderBy: { seq: 'desc' },
    });
  }

  /**
   * Walk the hash-chain in seq order and verify off-chain integrity.
   */
  async verifyChain(): Promise<{
    ok: boolean;
    total: number;
    brokenAtSeq: number | null;
    reason: string | null;
  }> {
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
        dataSalt: true,
        beforeHash: true,
        afterHash: true,
        diffHash: true,
        hashVersion: true,
        beforeEncrypted: true,
        afterEncrypted: true,
        diffJson: true,
        fieldsChanged: true,
        createdAt: true,
      },
    });

    let expectedPrev = GENESIS_PREV_HASH;
    let expectedSeq = 1;
    for (const row of rows) {
      if (row.seq !== expectedSeq) {
        const reason = `Đứt quãng số thứ tự: mong đợi ${expectedSeq}, nhận được ${row.seq}`;
        await this.anchor.sendTelegramAlert('Phát hiện đứt gãy chuỗi nhật ký (kiểm tra chuỗi)', reason, row.seq);
        return { ok: false, total: rows.length, brokenAtSeq: row.seq, reason };
      }
      if (row.prevHash !== expectedPrev) {
        const reason = 'prevHash không khớp entryHash liền trước; bản ghi có thể đã bị chèn, xóa hoặc sắp xếp lại';
        await this.anchor.sendTelegramAlert('Phát hiện đứt gãy chuỗi nhật ký (kiểm tra chuỗi)', reason, row.seq);
        return { ok: false, total: rows.length, brokenAtSeq: row.seq, reason };
      }
      const verification = verifyAuditRowLight(row);
      if (!verification.ok) {
        const reason = verification.reason || 'entryHash không khớp; nội dung bản ghi có thể đã bị sửa';
        await this.anchor.sendTelegramAlert('Phát hiện đứt gãy chuỗi nhật ký (kiểm tra chuỗi)', reason, row.seq);
        return { ok: false, total: rows.length, brokenAtSeq: row.seq, reason };
      }
      expectedPrev = row.entryHash!;
      expectedSeq += 1;
    }

    return { ok: true, total: rows.length, brokenAtSeq: null, reason: null };
  }
}

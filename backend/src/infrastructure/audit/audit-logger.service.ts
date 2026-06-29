import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  computeRecordHash,
  generateSalt,
  computeEntryHash,
  computeEntryHashV2,
  computeBeforeHashV2,
  computeAfterHashV2,
  computeDiffHashV2,
  computeDataHashV2,
  GENESIS_PREV_HASH,
  AUDIT_ENTRY_V2,
  canonicalize,
} from './audit-hash.util';
import { AuditAnchorService } from './audit-anchor.service';
import { sanitizeAuditPayload } from './audit-sanitizer.util';
import { buildAuditDiff } from './audit-diff.util';
import {
  AUDIT_ENCRYPTION_VERSION,
  buildAuditEncryptionAad,
  encryptAuditSnapshot,
} from './audit-encryption.util';
import { verifyAuditRow } from './audit-verification.util';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'ACCESS' | 'SECURITY';

/**
 * Maps an entity label to its foreign-key column on the BlockchainLogger table.
 * Exactly one of these FKs is populated per log row, letting us join a log back to
 * the concrete record it describes while keeping a single centralized logger table.
 */
const FK_FIELD: Record<string, string> = {
  Department: 'departmentId',
  StaffProfile: 'staffProfileId',
  DoctorProfile: 'doctorProfileId',
  Patient: 'patientId',
  AiModelRegistry: 'aiModelRegistryId',
  MedicalConclusion: 'medicalConclusionId',
  AiQuality: 'aiQualityId',
};

/**
 * AuditLoggerService is the shared write/read API for the centralized, tamper-evident
 * BlockchainLogger.
 *
 * Every entry is woven into a hash-chain: each row carries a monotonic `seq`, the previous
 * row's `entryHash` as `prevHash`, and its own `entryHash = H(pepper | seq | prevHash | core)`.
 * Because each leaf commits to the entire history before it, deleting or editing any past row
 * breaks the chain and is provable. Writes are serialized in-process so seq stays gap-free and
 * the chain is linear; the unique constraint on seq is a DB-level backstop.
 *
 * The chain leaves are later batched into a Merkle tree and a single root is anchored on-chain
 * by AuditAnchorService (gas stays flat regardless of volume). Tier-A events can request
 * immediate anchoring instead of waiting for the batch cycle.
 */
@Injectable()
export class AuditLoggerService {
  // Serializes chain writes so seq/prevHash are assigned without races (single-instance scope).
  private chainMutex: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly prisma: PrismaService,
    private readonly anchor: AuditAnchorService,
  ) {}

  /** Compute a fresh salt + integrity hash for a snapshot. */
  hashSnapshot(snapshot: unknown): { salt: string; hash: string } {
    const salt = generateSalt();
    const hash = computeRecordHash(snapshot, salt);
    return { salt, hash };
  }

  /** Recompute the integrity hash for a snapshot using a known salt (verification). */
  recompute(snapshot: unknown, salt: string): string {
    return computeRecordHash(snapshot, salt);
  }

  /** Run a function with exclusive access to the chain tail (serialized appends). */
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
   *
   * V1 rows are legacy-only in this dev codebase. All new writes go through the encrypted
   * before/after + field-diff V2 path so the UI, verification logic and Merkle anchoring operate
   * on one clean format.
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
    return this.enqueue(() => this.prisma.$transaction((transaction) => this.appendRecordV2(v2Params, transaction)));
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
    return this.enqueue(() => this.prisma.$transaction((transaction) => this.appendRecordV2(params, transaction)));
  }

  private toAuditSnapshot(value: unknown): Record<string, unknown> | null {
    if (value == null) return null;
    if (value instanceof Date) return { value: value.toISOString() };
    if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
    return { value };
  }

  private async appendRecord(
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
    client: Prisma.TransactionClient,
  ) {
    await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('blockchain_logger_chain'))`;

    // 1. Find the current chain tail to derive seq + prevHash.
    const tail = await client.blockchainLogger.findFirst({
      where: { seq: { not: null } },
      orderBy: { seq: 'desc' },
      select: { seq: true, entryHash: true },
    });
    const seq = (tail?.seq ?? 0) + 1;
    const prevHash = tail?.entryHash ?? GENESIS_PREV_HASH;
    const createdAt = new Date();

    // 2. Compute this entry's chain leaf.
    const entryHash = computeEntryHash(
      {
        seq,
        actorId: params.actorId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        dataHash: params.dataHash ?? null,
        createdAtIso: createdAt.toISOString(),
      },
      prevHash,
    );

    // 3. Build the row, attaching the single relevant entity FK.
    const fkField = FK_FIELD[params.entity];
    const data: Record<string, any> = {
      entity: params.entity,
      entityId: params.entityId,
      action: params.action,
      actorId: params.actorId ?? null,
      dataHash: params.dataHash ?? null,
      dataSalt: params.dataSalt ?? null,
      beforeJson: sanitizeAuditPayload(params.entity, params.before) as any,
      afterJson: sanitizeAuditPayload(params.entity, params.after) as any,
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
    const seq = (tail?.seq ?? 0) + 1;
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

  /** List change history for an entity (optionally a specific record), newest first. */
  history(entity: string, entityId?: string) {
    return this.prisma.blockchainLogger.findMany({
      where: { entity, ...(entityId ? { entityId } : {}) },
      orderBy: { seq: 'desc' },
    });
  }

  /**
   * Walk the hash-chain in seq order and recompute each entryHash, flagging the first row whose
   * recomputed hash or prevHash linkage diverges. A clean result proves no row was edited,
   * deleted, or reordered (assuming the env pepper is intact). This is the off-chain integrity
   * check; on-chain Merkle roots provide the same guarantee against an attacker who also holds
   * DB credentials.
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
      const verification = verifyAuditRow(row);
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

  verifyEntry(row: any): boolean {
    const recomputed = computeEntryHash(
      {
        seq: row.seq,
        actorId: row.actorId,
        action: row.action,
        entity: row.entity,
        entityId: row.entityId,
        dataHash: row.dataHash,
        createdAtIso: row.createdAt instanceof Date ? row.createdAt.toISOString() : new Date(row.createdAt).toISOString(),
      },
      row.prevHash ?? GENESIS_PREV_HASH,
    );
    return recomputed === row.entryHash;
  }
}

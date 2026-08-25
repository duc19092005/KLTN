import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditAnchorService } from '../anchoring/audit-anchor.service';
import { AUDIT_ENTRY_V2, GENESIS_PREV_HASH } from '../crypto/audit-hash.util';
import { compareLiveSnapshotToAuditAfter, verifyAuditRow } from '../logging/audit-verification.util';
import { EntityRecoveryTarget, RecoverableAuditEntity } from './entity-registry.config';
import { loadLiveEntitySnapshot } from './entity-snapshot.handler';

type AuditRow = NonNullable<Awaited<ReturnType<PrismaService['blockchainLogger']['findFirst']>>>;

const ENTITY_TABLES: Record<RecoverableAuditEntity, string> = {
  Patient: 'Patient',
  Department: 'Department',
  StaffProfile: 'StaffProfile',
  DoctorProfile: 'DoctorProfile',
  AiModelRegistry: 'AiModelRegistry',
  Visit: 'Visit',
  MedicalConclusion: 'MedicalConclusion',
  AiDiagnosis: 'AiDiagnosis',
  MedicalOrder: 'MedicalOrder',
  MedicalResult: 'MedicalResult',
  Appointment: 'Appointment',
  AiQuality: 'AiQuality',
};

export interface ClinicalTrustEvidence {
  entity: RecoverableAuditEntity;
  entityId: string;
  targetSeq: number;
  targetBatchId: number | null;
  checkpointSeq: number;
  verifiedSuffixLength: number;
  mode: 'ANCHORED_TARGET' | 'CHECKPOINT_SUFFIX' | 'GENESIS_SUFFIX';
}

/**
 * Fail-closed integrity gate for clinical mutations.
 *
 * The caller should pass the same Prisma transaction that will perform the
 * business mutation. The service locks every target row, then takes the audit
 * writer advisory lock, so verification, mutation and the next audit append
 * share one serialization boundary and cannot be separated by a TOCTOU window.
 */
@Injectable()
export class ClinicalAuditTrustService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly anchor: AuditAnchorService,
  ) {}

  async assertTrusted(
    target: EntityRecoveryTarget,
    tx?: Prisma.TransactionClient,
  ): Promise<ClinicalTrustEvidence> {
    const [evidence] = await this.assertManyTrusted([target], tx);
    return evidence;
  }

  async assertManyTrusted(
    targets: EntityRecoveryTarget[],
    tx?: Prisma.TransactionClient,
  ): Promise<ClinicalTrustEvidence[]> {
    const uniqueTargets = [...new Map(
      targets.map((target) => [`${target.entity}:${target.entityId}`, target]),
    ).values()].sort((left, right) =>
      left.entity.localeCompare(right.entity) || left.entityId.localeCompare(right.entityId),
    );

    if (uniqueTargets.length === 0) return [];
    if (tx) return this.assertManyInTransaction(uniqueTargets, tx);
    return this.prisma.$transaction((transaction) =>
      this.assertManyInTransaction(uniqueTargets, transaction),
    );
  }

  private async assertManyInTransaction(
    targets: EntityRecoveryTarget[],
    tx: Prisma.TransactionClient,
  ): Promise<ClinicalTrustEvidence[]> {
    await this.lockLiveRows(targets, tx);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('blockchain_logger_chain'))`;

    const rows = await Promise.all(targets.map(async (target) => {
      const row = await tx.blockchainLogger.findFirst({
        where: { entity: target.entity, entityId: target.entityId, seq: { not: null } },
        orderBy: { seq: 'desc' },
      });
      if (!row) {
        this.fail('AUDIT_TARGET_MISSING', target, 'Không có audit nguồn cho dữ liệu lâm sàng hiện tại.');
      }
      return row!;
    }));

    const verifiedRows = new Map<number, AuditRow>();
    const evidence: ClinicalTrustEvidence[] = [];
    for (let index = 0; index < targets.length; index += 1) {
      evidence.push(await this.verifyTarget(targets[index], rows[index], tx, verifiedRows));
    }
    return evidence;
  }

  private async verifyTarget(
    target: EntityRecoveryTarget,
    row: AuditRow,
    tx: Prisma.TransactionClient,
    verifiedRows: Map<number, AuditRow>,
  ): Promise<ClinicalTrustEvidence> {
    if (row.seq == null) {
      this.fail('AUDIT_TARGET_INVALID', target, 'Audit nguồn thiếu số thứ tự tin cậy.');
    }
    this.verifyFullRow(row, target, 'AUDIT_TARGET_INVALID', verifiedRows);

    let evidence: ClinicalTrustEvidence;
    if (row.onChainStatus === 'ANCHORED' && row.batchId != null) {
      evidence = await this.verifyAnchoredTarget(target, row, tx, verifiedRows);
    } else {
      evidence = await this.verifyPendingTargetSuffix(target, row, tx, verifiedRows);
    }

    const liveSnapshot = await loadLiveEntitySnapshot(tx, target.entity, target.entityId);
    if (!liveSnapshot) {
      this.fail('ENTITY_LIVE_MISSING', target, 'Dữ liệu nghiệp vụ đã bị xóa hoặc không còn đọc được.');
    }
    const comparison = compareLiveSnapshotToAuditAfter(row, liveSnapshot);
    if (!comparison.ok) {
      this.fail(
        'ENTITY_LIVE_TAMPERED',
        target,
        'Dữ liệu hiện tại không khớp snapshot audit đã được xác minh.',
        row,
        comparison.suspiciousFields,
      );
    }

    return evidence;
  }

  private async verifyAnchoredTarget(
    target: EntityRecoveryTarget,
    row: AuditRow,
    tx: Prisma.TransactionClient,
    verifiedRows: Map<number, AuditRow>,
  ): Promise<ClinicalTrustEvidence> {
    const proof = await this.anchor.getInclusionProof(row.seq!, tx);
    if (!proof?.verified || proof.batchId !== row.batchId || proof.entryHash !== row.entryHash) {
      this.fail(
        'AUDIT_CHECKPOINT_UNVERIFIED',
        target,
        'Không xác minh được audit mục tiêu với checkpoint blockchain.',
        row,
      );
    }

    if (row.seq === 1) {
      if ((row.prevHash ?? GENESIS_PREV_HASH) !== GENESIS_PREV_HASH) {
        this.fail('AUDIT_PREDECESSOR_INVALID', target, 'Liên kết genesis của audit không hợp lệ.', row);
      }
    } else {
      const predecessor = await tx.blockchainLogger.findFirst({ where: { seq: row.seq! - 1 } });
      if (!predecessor || predecessor.seq !== row.seq! - 1) {
        this.fail('AUDIT_PREDECESSOR_INVALID', target, 'Không tìm thấy audit liền trước mục tiêu.', row);
      }
      this.verifyFullRow(predecessor!, target, 'AUDIT_PREDECESSOR_INVALID', verifiedRows);
      if (row.prevHash !== predecessor!.entryHash) {
        this.fail('AUDIT_PREDECESSOR_INVALID', target, 'Hash của audit liền trước không nối với audit mục tiêu.', row);
      }
    }

    return {
      entity: target.entity,
      entityId: target.entityId,
      targetSeq: row.seq!,
      targetBatchId: row.batchId,
      checkpointSeq: row.seq!,
      verifiedSuffixLength: 0,
      mode: 'ANCHORED_TARGET',
    };
  }

  private async verifyPendingTargetSuffix(
    target: EntityRecoveryTarget,
    row: AuditRow,
    tx: Prisma.TransactionClient,
    verifiedRows: Map<number, AuditRow>,
  ): Promise<ClinicalTrustEvidence> {
    const checkpoint = await this.anchor.getLatestVerifiedCheckpointBefore(row.seq!, tx);
    const fromSeq = checkpoint ? checkpoint.toSeq + 1 : 1;
    const suffix = await tx.blockchainLogger.findMany({
      where: { seq: { gte: fromSeq, lte: row.seq! } },
      orderBy: { seq: 'asc' },
    });

    const expectedLength = row.seq! - fromSeq + 1;
    if (suffix.length !== expectedLength) {
      this.fail('AUDIT_SUFFIX_GAP', target, 'Chuỗi audit chưa neo bị thiếu số thứ tự.', row);
    }

    let expectedSeq = fromSeq;
    let expectedPrevHash = checkpoint?.entryHash ?? GENESIS_PREV_HASH;
    for (const suffixRow of suffix) {
      if (suffixRow.seq !== expectedSeq) {
        this.fail('AUDIT_SUFFIX_GAP', target, 'Chuỗi audit chưa neo không liên tục.', suffixRow);
      }
      if (suffixRow.prevHash !== expectedPrevHash) {
        this.fail('AUDIT_SUFFIX_TAMPERED', target, 'Liên kết hash trong chuỗi audit chưa neo không hợp lệ.', suffixRow);
      }
      this.verifyFullRow(suffixRow, target, 'AUDIT_SUFFIX_TAMPERED', verifiedRows);
      expectedPrevHash = suffixRow.entryHash!;
      expectedSeq += 1;
    }

    const suffixTarget = suffix[suffix.length - 1];
    if (!suffixTarget || suffixTarget.seq !== row.seq || suffixTarget.entryHash !== row.entryHash) {
      this.fail('AUDIT_SUFFIX_TAMPERED', target, 'Audit mục tiêu không khớp đuôi chuỗi đã xác minh.', row);
    }

    return {
      entity: target.entity,
      entityId: target.entityId,
      targetSeq: row.seq!,
      targetBatchId: null,
      checkpointSeq: checkpoint?.toSeq ?? 0,
      verifiedSuffixLength: suffix.length,
      mode: checkpoint ? 'CHECKPOINT_SUFFIX' : 'GENESIS_SUFFIX',
    };
  }

  private verifyFullRow(
    row: AuditRow,
    target: EntityRecoveryTarget,
    code: string,
    verifiedRows: Map<number, AuditRow>,
  ): void {
    if (row.seq != null && verifiedRows.has(row.seq)) return;
    if (row.hashVersion !== AUDIT_ENTRY_V2) {
      this.fail(code, target, 'Audit legacy không đủ bằng chứng để dùng làm chốt chặn lâm sàng.', row);
    }
    const verification = verifyAuditRow(row);
    if (!verification.ok) {
      this.fail(code, target, 'Audit log không tự xác minh được hoặc đã bị sửa đổi.', row, verification.suspiciousFields);
    }
    verifiedRows.set(row.seq!, row);
  }

  private async lockLiveRows(targets: EntityRecoveryTarget[], tx: Prisma.TransactionClient): Promise<void> {
    for (const target of targets) {
      const table = Prisma.raw(`"${ENTITY_TABLES[target.entity]}"`);
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM ${table} WHERE "id" = ${target.entityId} FOR UPDATE`);
    }
  }

  private fail(
    code: string,
    target: EntityRecoveryTarget,
    message: string,
    row?: Pick<AuditRow, 'seq' | 'batchId'>,
    suspiciousFields: string[] = [],
  ): never {
    throw new ConflictException({
      statusCode: 409,
      code,
      message,
      entity: target.entity,
      entityId: target.entityId,
      targetSeq: row?.seq ?? null,
      batchId: row?.batchId ?? null,
      suspiciousFields: suspiciousFields.length > 0 ? ['INTEGRITY_PROTECTED_FIELD_CHANGED'] : [],
      recoveryRequired: true,
    });
  }
}

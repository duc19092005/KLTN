import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditAnchorService } from '../anchoring/audit-anchor.service';
import {
  compareLiveSnapshotToAuditAfter,
  verifyAuditRow,
  verifyAuditRowLight,
} from '../logging/audit-verification.util';
import { canonicalize } from '../crypto/audit-hash.util';
import { EntityRecreationBundleCache, EntityRecreationService } from './entity-recreation.service';
import {
  EntityIntegrityWarning,
  RecoverableAuditEntity,
  REQUIRED_SNAPSHOT_FIELDS,
  SENSITIVE_FIELDS,
} from './entity-registry.config';
import { loadLiveEntitySnapshot } from './entity-snapshot.handler';
import { EntityClusterResolver } from './entity-cluster-resolver';

type Snapshot = Record<string, unknown>;
type AnchoredAuditRow = NonNullable<Awaited<ReturnType<PrismaService['blockchainLogger']['findFirst']>>>;

@Injectable()
export class EntityIntegrityEvaluator {
  constructor(
    private readonly prisma: PrismaService,
    private readonly anchor: AuditAnchorService,
    private readonly clusterResolver: EntityClusterResolver,
    @Optional() private readonly recreation?: EntityRecreationService,
  ) {}

  async evaluateRow(
    row: AnchoredAuditRow,
    recreationCache?: EntityRecreationBundleCache,
  ): Promise<EntityIntegrityWarning | null> {
    if (!this.isRecoverableEntity(row.entity) || !row.entityId) return null;
    const entity = row.entity;
    const base = {
      entity,
      entityId: row.entityId,
      latestTrustedSeq: row.seq,
      batchId: row.batchId,
      anchoredAt: row.createdAt,
      sensitiveDataHidden: true as const,
    };

    const lightVerification = verifyAuditRowLight(row);
    if (!lightVerification.ok) {
      const cluster = await this.clusterResolver.resolveClusterInfo(entity, row.entityId, null, row);
      return {
        ...base,
        ...cluster,
        status: 'AUDIT_UNTRUSTED',
        recoverable: false,
        fieldsChanged: ['audit_tampered'],
        blockers: ['AUDIT_ROW_INVALID'],
        dependencies: [],
        recoveryMode: 'AUDIT_BATCH_FIRST',
        message: 'Bản ghi audit log không hợp lệ hoặc đã bị sửa đổi. Cần khôi phục audit batch từ IPFS/blockchain trước.',
      };
    }

    const liveSnapshot = await loadLiveEntitySnapshot(this.prisma, entity, row.entityId);
    const cluster = await this.clusterResolver.resolveClusterInfo(entity, row.entityId, liveSnapshot, row);

    if (!liveSnapshot) {
      const intentionallyDeleted = await this.isIntentionallyDeleted(row.entityId);
      if (intentionallyDeleted) return null;

      if (!this.recreation) {
        return {
          ...base,
          ...cluster,
          status: 'MISSING',
          recoverable: false,
          fieldsChanged: ['record_deleted'],
          blockers: ['ENTITY_RECREATION_UNAVAILABLE'],
          dependencies: [],
          recoveryMode: 'PITR_REQUIRED',
          message: 'Bản ghi nghiệp vụ đã bị xóa khỏi cơ sở dữ liệu.',
        };
      }

      const preview = await this.recreation.previewOne({ entity, entityId: row.entityId }, recreationCache);
      return {
        ...base,
        ...cluster,
        status: 'MISSING',
        recoverable: preview.recoverable,
        fieldsChanged: ['record_deleted'],
        blockers: preview.blockers,
        dependencies: preview.dependencies,
        recoveryMode: preview.recoveryMode,
        autoResolvable: preview.autoResolvable,
        message: preview.message,
      };
    }

    const fullVerification = verifyAuditRow(row);
    if (!fullVerification.ok || !fullVerification.decryptedAfter) {
      return {
        ...base,
        ...cluster,
        status: 'AUDIT_UNTRUSTED',
        recoverable: false,
        fieldsChanged: ['audit_decryption_failed'],
        blockers: ['AUDIT_DECRYPT_FAILED'],
        dependencies: [],
        recoveryMode: 'AUDIT_BATCH_FIRST',
        message: 'Không thể giải mã bản ghi audit nguồn để kiểm tra.',
      };
    }

    const effectiveSnapshot = this.effectiveRecoverySnapshot(entity, fullVerification.decryptedAfter as Snapshot, liveSnapshot);
    if (this.snapshotsEqual(effectiveSnapshot, liveSnapshot)) return null;

    const comparison = compareLiveSnapshotToAuditAfter(row, liveSnapshot);

    if (!this.hasCompleteSnapshot(entity, fullVerification.decryptedAfter)) {
      const partialCheck = this.compareCommittedSnapshotFields(entity, fullVerification.decryptedAfter, liveSnapshot);
      if (partialCheck.ok) return null;

      return {
        ...base,
        ...cluster,
        status: 'SNAPSHOT_INCOMPLETE',
        recoverable: false,
        fieldsChanged: this.safeFieldNames(entity, partialCheck.suspiciousFields),
        blockers: ['INCOMPLETE_SNAPSHOT_IN_AUDIT'],
        dependencies: [],
        recoveryMode: 'PITR_REQUIRED',
        message: 'Bản audit không có đủ các trường bắt buộc để tự động khôi phục an toàn.',
      };
    }

    if (row.onChainStatus !== 'ANCHORED' || row.batchId == null) {
      return {
        ...base,
        ...cluster,
        status: 'TAMPERED',
        recoverable: false,
        fieldsChanged: this.safeFieldNames(entity, comparison.suspiciousFields),
        blockers: ['AUDIT_ROW_UNANCHORED'],
        dependencies: [],
        recoveryMode: 'DIRECT_ENTITY',
        message: 'Dữ liệu hiện tại không khớp với audit log gần nhất, nhưng bản audit này chưa được neo lên blockchain. Cần kiểm tra thủ công.',
      };
    }

    let proofVerified = false;
    if (row.seq != null) {
      try {
        const proof = await this.anchor.getInclusionProof(row.seq);
        proofVerified = Boolean(proof?.verified);
      } catch {
        proofVerified = false;
      }
    }

    if (!proofVerified) {
      return {
        ...base,
        ...cluster,
        status: 'TAMPERED',
        recoverable: false,
        fieldsChanged: this.safeFieldNames(entity, comparison.suspiciousFields),
        blockers: ['MERKLE_PROOF_UNVERIFIED'],
        dependencies: [],
        recoveryMode: 'DIRECT_ENTITY',
        message: 'Dữ liệu hiện tại không khớp với audit log đã neo, nhưng Merkle proof chưa xác minh được với blockchain. Vui lòng kiểm tra batch on-chain.',
      };
    }

    return {
      ...base,
      ...cluster,
      status: 'TAMPERED',
      recoverable: true,
      autoResolvable: true,
      fieldsChanged: this.safeFieldNames(entity, comparison.suspiciousFields),
      blockers: [],
      dependencies: [],
      recoveryMode: 'DIRECT_ENTITY',
      message: 'Dữ liệu hiện tại không khớp bản audit đã được blockchain xác nhận. Mọi sửa/xóa đã bị chặn.',
    };
  }

  hasCompleteSnapshot(entity: RecoverableAuditEntity, value: unknown): value is Snapshot {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    return REQUIRED_SNAPSHOT_FIELDS[entity].every((field) => Object.prototype.hasOwnProperty.call(value, field));
  }

  effectiveRecoverySnapshot(entity: RecoverableAuditEntity, source: Snapshot, live: Snapshot): Snapshot {
    if ((entity === 'StaffProfile' || entity === 'DoctorProfile') && source.status == null) {
      return { ...source, status: live.status };
    }
    if (entity === 'MedicalResult' && 'status' in source) {
      const { status: _status, ...rest } = source;
      return rest;
    }
    return source;
  }

  snapshotsEqual(left: Snapshot, right: Snapshot): boolean {
    return canonicalize(left) === canonicalize(right);
  }

  compareCommittedSnapshotFields(
    entity: RecoverableAuditEntity,
    source: unknown,
    live: Snapshot,
  ): { ok: boolean; suspiciousFields: string[] } {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      return { ok: false, suspiciousFields: [] };
    }

    const snapshot = source as Snapshot;
    const committedFields = REQUIRED_SNAPSHOT_FIELDS[entity].filter((field) =>
      Object.prototype.hasOwnProperty.call(snapshot, field),
    );
    const suspiciousFields = committedFields.filter(
      (field) => canonicalize(snapshot[field]) !== canonicalize(live[field]),
    );
    return { ok: suspiciousFields.length === 0, suspiciousFields };
  }

  safeFieldNames(entity: RecoverableAuditEntity, fields: string[]): string[] {
    const sensitive = SENSITIVE_FIELDS[entity];
    const result = new Set<string>();
    for (const field of fields) result.add(sensitive?.has(field) ? 'SENSITIVE_FIELD_CHANGED' : field);
    return [...result];
  }

  private isRecoverableEntity(entity: string): entity is RecoverableAuditEntity {
    return (REQUIRED_SNAPSHOT_FIELDS as Record<string, unknown>)[entity] !== undefined;
  }

  private async isIntentionallyDeleted(entityId: string): Promise<boolean> {
    const row = await this.prisma.blockchainLogger.findFirst({
      where: {
        entity: 'AdministrativeDeletion',
        entityId,
        action: 'PERMANENT_DELETE',
        seq: { not: null },
      },
      select: { id: true },
    });
    return row !== null;
  }
}
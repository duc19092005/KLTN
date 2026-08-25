import { ConflictException, forwardRef, Inject, Injectable, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditAnchorService } from '../anchoring/audit-anchor.service';
import { AuditLoggerService } from '../logging/audit-logger.service';
import {
  compareLiveSnapshotToAuditAfter,
  verifyAuditRow,
  verifyAuditRowLight,
} from '../logging/audit-verification.util';
import { canonicalize } from '../crypto/audit-hash.util';
import { EntityRecreationBundleCache, EntityRecreationService } from './entity-recreation.service';
import { AuditRecoveryService } from './audit-recovery.service';
import {
  ENTITY_DEPENDENCY_ORDER,
  EntityIntegrityWarning,
  EntityRecoveryTarget,
  RECOVERABLE_AUDIT_ENTITIES,
  RecoverableAuditEntity,
  REQUIRED_SNAPSHOT_FIELDS,
  SENSITIVE_FIELDS,
} from './entity-registry.config';
import { loadLiveEntitySnapshot, restoreEntitySnapshotData } from './entity-snapshot.handler';

type Snapshot = Record<string, unknown>;
type AnchoredAuditRow = NonNullable<Awaited<ReturnType<PrismaService['blockchainLogger']['findFirst']>>>;

/**
 * EntityRecoveryService coordinates integrity scanning and clinical entity restoration
 * using verified, on-chain anchored audit snapshots.
 */
@Injectable()
export class EntityRecoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLoggerService,
    private readonly anchor: AuditAnchorService,
    @Optional() @Inject(forwardRef(() => AuditRecoveryService)) private readonly batchRecovery?: AuditRecoveryService,
    @Optional() @Inject(forwardRef(() => EntityRecreationService)) private readonly recreation?: EntityRecreationService,
  ) {}

  async previewMany(targets: EntityRecoveryTarget[]) {
    const uniqueTargets = [...new Map(targets.map((target) => [this.targetKey(target.entity, target.entityId), target])).values()];
    uniqueTargets.sort((a, b) => (ENTITY_DEPENDENCY_ORDER[a.entity] ?? 99) - (ENTITY_DEPENDENCY_ORDER[b.entity] ?? 99));
    const items: Array<Record<string, unknown>> = [];
    const recreationCache = this.recreation?.createBundleCache();
    for (const target of uniqueTargets) {
      const live = await loadLiveEntitySnapshot(this.prisma, target.entity, target.entityId);
      if (!live) {
        if (!this.recreation) {
          items.push({ ...target, state: 'MISSING', operation: 'RECREATE', recoverable: false, blockers: ['ENTITY_RECREATION_UNAVAILABLE'], sensitiveDataHidden: true });
        } else {
          items.push({ ...(await this.recreation.previewOne(target, recreationCache)) });
        }
        continue;
      }

      const row = await this.findLatestRow(target.entity, target.entityId);
      const warning = row ? await this.evaluateRow(row) : null;
      items.push({
        ...target,
        state: 'EXISTS',
        operation: warning?.recoverable ? 'UPDATE' : 'NONE',
        recoverable: Boolean(warning?.recoverable),
        sourceSeq: warning?.latestTrustedSeq ?? null,
        sourceBatchId: warning?.batchId ?? null,
        source: warning?.recoverable ? 'ANCHORED_AUDIT' : null,
        blockers: warning && !warning.recoverable ? warning.blockers : [],
        dependencies: warning?.dependencies ?? [],
        recoveryMode: warning?.recoveryMode ?? 'DIRECT_ENTITY',
        clusterKey: warning?.clusterKey ?? target.entityId,
        clusterLabel: warning?.clusterLabel ?? null,
        autoResolvable: warning?.autoResolvable ?? false,
        sensitiveDataHidden: true,
      });
    }
    return { items, total: items.length, recoverable: items.filter((item) => item.recoverable === true).length };
  }

  async listWarnings(limit = 100): Promise<{ items: EntityIntegrityWarning[]; total: number }> {
    const groups = await this.prisma.blockchainLogger.groupBy({
      by: ['entity', 'entityId'],
      where: {
        entity: { in: [...RECOVERABLE_AUDIT_ENTITIES] },
        entityId: { not: null },
        seq: { not: null },
      },
      _max: { seq: true },
      orderBy: { _max: { seq: 'desc' } },
      take: Math.min(Math.max(limit, 1), 200),
    });
    const rows = await this.prisma.blockchainLogger.findMany({
      where: { seq: { in: groups.map((group) => group._max.seq).filter((seq): seq is number => seq != null) } },
      orderBy: { seq: 'desc' },
    });

    const latest = new Map<string, AnchoredAuditRow>();
    for (const row of rows) {
      if (!this.isRecoverableEntity(row.entity) || !row.entityId) continue;
      const key = this.targetKey(row.entity, row.entityId);
      if (!latest.has(key)) latest.set(key, row);
    }

    const recreationCache = this.recreation?.createBundleCache();
    const evaluated = await Promise.all(
      Array.from(latest.values()).map((row) => this.evaluateRow(row, recreationCache)),
    );
    const warnings = evaluated.filter((warning): warning is EntityIntegrityWarning => warning !== null);

    return { items: warnings, total: warnings.length };
  }

  async assertTrusted(entity: RecoverableAuditEntity, entityId: string): Promise<void> {
    const row = await this.findLatestRow(entity, entityId);
    if (!row) return;
    const warning = await this.evaluateRow(row);
    if (!warning) return;

    throw new ConflictException({
      statusCode: 409,
      code: 'ENTITY_INTEGRITY_WARNING',
      message: warning.message,
      entity: warning.entity,
      entityId: warning.entityId,
      batchId: warning.batchId,
      latestTrustedSeq: warning.latestTrustedSeq,
      fieldsChanged: warning.fieldsChanged,
      blockers: warning.blockers,
      dependencies: warning.dependencies,
      recoveryMode: warning.recoveryMode,
      recoveryRequired: warning.recoverable,
    });
  }

  async recoverMany(targets: EntityRecoveryTarget[], actorId: string, reason: string) {
    const uniqueTargets = [...new Map(targets.map((target) => [this.targetKey(target.entity, target.entityId), target])).values()];
    uniqueTargets.sort((a, b) => (ENTITY_DEPENDENCY_ORDER[a.entity] ?? 99) - (ENTITY_DEPENDENCY_ORDER[b.entity] ?? 99));
    const results: Array<Record<string, unknown>> = [];
    const recreationCache = this.recreation?.createBundleCache();

    for (const target of uniqueTargets) {
      try {
        results.push(await this.recoverOne(target, actorId, reason, recreationCache));
      } catch (error) {
        console.error('RECOVERY ERROR:', error);
        results.push({
          ...target,
          status: 'FAILED',
          message: this.safeErrorMessage(error),
        });
      }
    }

    return {
      requested: uniqueTargets.length,
      recovered: results.filter((result) => result.status === 'RECOVERED' || result.status === 'RECREATED').length,
      skipped: results.filter((result) => result.status === 'SKIPPED').length,
      failed: results.filter((result) => result.status === 'FAILED').length,
      results,
    };
  }

  private async resolveClusterInfo(
    entity: RecoverableAuditEntity,
    entityId: string,
    snapshot: Snapshot | null,
  ): Promise<{ clusterKey: string; clusterLabel: string }> {
    if (!snapshot) return { clusterKey: entityId, clusterLabel: `${entity} (${entityId.slice(0, 8)})` };

    if (entity === 'Visit') {
      const visitCode = (snapshot.visitCode as string) || entityId.slice(0, 8);
      return { clusterKey: entityId, clusterLabel: `Ca khám #${visitCode}` };
    }
    if (entity === 'MedicalConclusion' || entity === 'AiDiagnosis' || entity === 'MedicalOrder' || entity === 'MedicalResult') {
      const visitId = (snapshot.visitId as string) || null;
      if (visitId) {
        return { clusterKey: visitId, clusterLabel: `Ca khám (${visitId.slice(0, 8)})` };
      }
    }
    if (entity === 'AiQuality') {
      const visitId = (snapshot.visitId as string) || null;
      if (visitId) {
        return { clusterKey: visitId, clusterLabel: `Ca khám (${visitId.slice(0, 8)})` };
      }
      const diagnosisId = (snapshot.aiDiagnosisId as string) || null;
      if (diagnosisId) {
        const diagRow = await this.prisma.blockchainLogger.findFirst({
          where: { entity: 'AiDiagnosis', entityId: diagnosisId },
          orderBy: { seq: 'desc' },
          select: { afterEncrypted: true, seq: true, action: true, entity: true, entityId: true, createdAt: true },
        });
        if (diagRow) {
          const diagVerif = verifyAuditRow(diagRow as any);
          if (diagVerif.ok && diagVerif.decryptedAfter && (diagVerif.decryptedAfter as any).visitId) {
            const diagVisitId = (diagVerif.decryptedAfter as any).visitId as string;
            return { clusterKey: diagVisitId, clusterLabel: `Ca khám (${diagVisitId.slice(0, 8)})` };
          }
        }
        return { clusterKey: diagnosisId, clusterLabel: `Chẩn đoán AI (${diagnosisId.slice(0, 8)})` };
      }
    }
    if (entity === 'Appointment' || entity === 'Patient') {
      const patientId = (snapshot.patientId as string) || entityId;
      const patientCode = (snapshot.patientCode as string) || patientId.slice(0, 8);
      return { clusterKey: patientId, clusterLabel: `Hồ sơ BN #${patientCode}` };
    }
    return { clusterKey: entityId, clusterLabel: `${entity} (${entityId.slice(0, 8)})` };
  }

  private async recoverOne(
    target: EntityRecoveryTarget,
    actorId: string,
    reason: string,
    recreationCache?: EntityRecreationBundleCache,
  ) {
    const liveSnapshot = await loadLiveEntitySnapshot(this.prisma, target.entity, target.entityId);
    if (!liveSnapshot) {
      if (!this.recreation) throw new ConflictException('Entity recreation service chưa được cấu hình.');
      return this.recreation.recreate(target, actorId, reason, recreationCache);
    }

    const row = await this.findLatestCompleteAnchoredRow(target.entity, target.entityId);
    if (!row || row.seq == null || row.batchId == null) {
      throw new ConflictException('Không có audit đã neo để làm nguồn khôi phục.');
    }

    const verification = verifyAuditRow(row);
    let proofVerified = false;
    if (verification.ok && row.seq != null) {
      try {
        const proof = await this.anchor.getInclusionProof(row.seq);
        proofVerified = Boolean(proof?.verified);
      } catch {
        proofVerified = false;
      }
    }

    let sourceSnapshot: Snapshot;
    let sourceSeq = row.seq;
    let sourceBatchId = row.batchId;
    let isTamperedAudit = false;
    let recoverySource: 'LOCAL_BLOCKCHAIN_VERIFIED' | 'IPFS_RECOVERED' = 'LOCAL_BLOCKCHAIN_VERIFIED';

    if (verification.ok && proofVerified && verification.decryptedAfter) {
      sourceSnapshot = this.requireCompleteSnapshot(target.entity, verification.decryptedAfter);
    } else {
      isTamperedAudit = true;
      recoverySource = 'IPFS_RECOVERED';

      if (!this.batchRecovery) {
        throw new ConflictException('Audit log local có dấu hiệu bị sửa đổi và dịch vụ IPFS recovery chưa sẵn sàng.');
      }

      const verifiedBundle = await this.batchRecovery.loadVerifiedBundle(row.batchId);
      const matchingRow = verifiedBundle.logs.find(
        (l) => l.entity === target.entity && l.entityId === target.entityId && l.seq === row.seq
      ) || verifiedBundle.logs.find(
        (l) => l.entity === target.entity && l.entityId === target.entityId
      );

      if (!matchingRow) {
        throw new ConflictException(`Không tìm thấy bản ghi ${target.entity} trong IPFS artifact của Batch #${row.batchId}.`);
      }

      const ipfsVerif = verifyAuditRow(matchingRow as any);
      if (!ipfsVerif.ok || !ipfsVerif.decryptedAfter) {
        throw new ConflictException('Không giải mã được snapshot từ IPFS artifact.');
      }

      sourceSnapshot = this.requireCompleteSnapshot(target.entity, ipfsVerif.decryptedAfter);
      sourceSeq = matchingRow.seq;
    }

    const snapshot = this.effectiveRecoverySnapshot(target.entity, sourceSnapshot, liveSnapshot);
    if (this.snapshotsEqual(snapshot, liveSnapshot)) {
      return {
        ...target,
        status: 'SKIPPED',
        sourceSeq,
        batchId: sourceBatchId,
        source: recoverySource,
        tamperDetected: isTamperedAudit,
      };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`audit-entity-recovery:${target.entity}:${target.entityId}`}))`;
      const current = await loadLiveEntitySnapshot(tx, target.entity, target.entityId);
      if (!current) throw new ConflictException('Bản ghi đã bị xóa trong lúc khôi phục.');
      const transactionSnapshot = this.effectiveRecoverySnapshot(target.entity, sourceSnapshot, current);
      if (this.snapshotsEqual(transactionSnapshot, current)) return;

      await restoreEntitySnapshotData(tx, target.entity, target.entityId, transactionSnapshot);
      const restored = await loadLiveEntitySnapshot(tx, target.entity, target.entityId);
      if (!restored) throw new ConflictException('Không đọc lại được bản ghi sau khôi phục.');
      if (!this.snapshotsEqual(transactionSnapshot, restored)) {
        throw new ConflictException('Dữ liệu sau khôi phục vẫn không khớp audit nguồn.');
      }

      const integrity = this.audit.hashSnapshot(restored);
      await this.updateIntegrityHash(tx, target.entity, target.entityId, integrity.hash, integrity.salt);

      await this.audit.recordV2({
        entity: target.entity,
        entityId: target.entityId,
        action: 'AUDIT_ENTITY_RECOVERED',
        actorId: actorId || null,
        before: current,
        after: restored,
        metadata: {
          reason,
          sourceSeq,
          sourceBatchId,
          source: recoverySource,
          tamperDetected: isTamperedAudit,
        },
      }, tx);
    });

    return {
      ...target,
      status: 'RECOVERED',
      sourceSeq,
      batchId: sourceBatchId,
      source: recoverySource,
      tamperDetected: isTamperedAudit,
      warning: isTamperedAudit
        ? `Phát hiện audit log của ${target.entity} (${target.entityId}) có dấu hiệu bị can thiệp trong CSDL; hệ thống đã tự động đối soát Blockchain và khôi phục an toàn từ IPFS.`
        : null,
    };
  }

  private async evaluateRow(
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
      const cluster = await this.resolveClusterInfo(entity, row.entityId, null);
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
    const cluster = await this.resolveClusterInfo(entity, row.entityId, liveSnapshot);

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

  private updateIntegrityHash(client: Prisma.TransactionClient, entity: RecoverableAuditEntity, entityId: string, hash256: string, dataSalt: string) {
    const data = { hash256, dataSalt };
    if (entity === 'Patient') return client.patient.update({ where: { id: entityId }, data });
    if (entity === 'Department') return client.department.update({ where: { id: entityId }, data });
    if (entity === 'StaffProfile') return client.staffProfile.update({ where: { id: entityId }, data });
    if (entity === 'DoctorProfile') return client.doctorProfile.update({ where: { id: entityId }, data });
    if (entity === 'AiModelRegistry') return client.aiModelRegistry.update({ where: { id: entityId }, data });
    if (entity === 'Visit') return Promise.resolve(null);
    if (entity === 'AiDiagnosis') return Promise.resolve(null);
    if (entity === 'MedicalOrder') return Promise.resolve(null);
    if (entity === 'MedicalResult') return Promise.resolve(null);
    if (entity === 'Appointment') return Promise.resolve(null);
    if (entity === 'AiQuality') return client.aiQuality.update({ where: { id: entityId }, data });
    return client.medicalConclusion.update({ where: { id: entityId }, data });
  }

  private findLatestAnchoredRow(entity: RecoverableAuditEntity, entityId: string) {
    return this.prisma.blockchainLogger.findFirst({
      where: {
        entity,
        entityId,
        seq: { not: null },
        batchId: { not: null },
        onChainStatus: 'ANCHORED',
      },
      orderBy: { seq: 'desc' },
    });
  }

  private async findLatestCompleteAnchoredRow(entity: RecoverableAuditEntity, entityId: string) {
    const rows = await this.prisma.blockchainLogger.findMany({
      where: {
        entity,
        entityId,
        seq: { not: null },
        batchId: { not: null },
        onChainStatus: 'ANCHORED',
      },
      orderBy: { seq: 'desc' },
      take: 50,
    });
    for (const row of rows) {
      const verification = verifyAuditRow(row);
      if (!verification.ok) continue;
      if (this.hasCompleteSnapshot(entity, verification.decryptedAfter)) return row;
    }
    return null;
  }

  private findLatestRow(entity: RecoverableAuditEntity, entityId: string) {
    return this.prisma.blockchainLogger.findFirst({
      where: { entity, entityId, seq: { not: null } },
      orderBy: { seq: 'desc' },
    });
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

  private requireCompleteSnapshot(entity: RecoverableAuditEntity, value: unknown): Snapshot {
    if (!this.hasCompleteSnapshot(entity, value)) throw new ConflictException('Snapshot audit không đủ trường bắt buộc để khôi phục an toàn.');
    return value;
  }

  private hasCompleteSnapshot(entity: RecoverableAuditEntity, value: unknown): value is Snapshot {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    return REQUIRED_SNAPSHOT_FIELDS[entity].every((field) => Object.prototype.hasOwnProperty.call(value, field));
  }

  private effectiveRecoverySnapshot(entity: RecoverableAuditEntity, source: Snapshot, live: Snapshot): Snapshot {
    if ((entity === 'StaffProfile' || entity === 'DoctorProfile') && source.status == null) {
      return { ...source, status: live.status };
    }
    if (entity === 'MedicalResult' && 'status' in source) {
      const { status: _status, ...rest } = source;
      return rest;
    }
    return source;
  }

  private snapshotsEqual(left: Snapshot, right: Snapshot): boolean {
    return canonicalize(left) === canonicalize(right);
  }

  private compareCommittedSnapshotFields(
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

  private safeFieldNames(entity: RecoverableAuditEntity, fields: string[]): string[] {
    const sensitive = SENSITIVE_FIELDS[entity];
    const result = new Set<string>();
    for (const field of fields) result.add(sensitive?.has(field) ? 'SENSITIVE_FIELD_CHANGED' : field);
    return [...result];
  }

  private isRecoverableEntity(entity: string): entity is RecoverableAuditEntity {
    return (RECOVERABLE_AUDIT_ENTITIES as readonly string[]).includes(entity);
  }

  private targetKey(entity: RecoverableAuditEntity, entityId: string) { return `${entity}:${entityId}`; }

  private safeErrorMessage(error: unknown): string {
    if (error instanceof ConflictException) {
      const response = error.getResponse();
      if (typeof response === 'string') return response;
      if (response && typeof response === 'object' && 'message' in response) return String(response.message);
    }
    return 'Không thể khôi phục entity. Kiểm tra audit batch và các quan hệ liên quan.';
  }
}

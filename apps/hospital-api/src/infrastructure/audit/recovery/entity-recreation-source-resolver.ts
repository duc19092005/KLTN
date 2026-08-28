import { ConflictException, Injectable, Optional } from '@nestjs/common';
import { OperationalStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditRecoveryBundleRow } from '../ipfs/audit-artifact.service';
import { verifyAuditRow } from '../logging/audit-verification.util';
import { VerifiedAuditBundleReader } from './verified-audit-bundle.reader';
import {
  EntityRecreationTarget,
  parseNullableString,
  recoveryEnvelope,
} from './entity-recreation-factory';
import {
  REQUIRED_SNAPSHOT_FIELDS,
  RecoverableAuditEntity,
} from './entity-registry.config';
import { VerifiedAuditRecoveryBundle } from './deep-scan-state';

type Snapshot = Record<string, unknown>;
export type EntityRecreationBundleCache = Map<number, Promise<VerifiedAuditRecoveryBundle>>;

export interface TrustedEntitySource {
  snapshot: Snapshot;
  sourceSeq: number;
  sourceBatchId: number;
  artifactHash: string;
}

@Injectable()
export class EntityRecreationSourceResolver {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly verifiedBundleReader?: VerifiedAuditBundleReader,
  ) {}

  async resolveTrustedSource(target: EntityRecreationTarget, cache: EntityRecreationBundleCache): Promise<TrustedEntitySource> {
    const localRow = this.prisma?.blockchainLogger?.findFirst
      ? await this.prisma.blockchainLogger.findFirst({
          where: {
            entity: { in: [target.entity, 'AdministrativeDeletion'] },
            entityId: target.entityId,
            batchId: { not: null },
            onChainStatus: 'ANCHORED',
          },
          orderBy: { seq: 'desc' },
          select: { batchId: true },
        }).catch(() => null)
      : null;

    if (localRow?.batchId && this.prisma?.auditBatch?.findUnique) {
      const batch = await this.prisma.auditBatch.findUnique({
        where: { batchId: localRow.batchId },
        select: { batchId: true, status: true, artifactHash: true, artifactUri: true },
      }).catch(() => null);
      if (batch && batch.status === 'ANCHORED' && batch.artifactHash && batch.artifactUri) {
        try {
          let pending = cache.get(batch.batchId);
          if (!pending) {
            pending = this.verifiedBundleReader!.loadVerifiedBundle(batch.batchId);
            cache.set(batch.batchId, pending);
          }
          const verified = await pending;
          const rows = [...verified.logs].sort((left, right) => right.seq - left.seq);
          for (const row of rows) {
            const snapshot = this.snapshotFromRow(row, target, verified.logs);
            if (snapshot) {
              return {
                snapshot,
                sourceSeq: row.seq,
                sourceBatchId: batch.batchId,
                artifactHash: verified.artifactHash,
              };
            }
          }
        } catch {
          // fallback to scan
        }
      }
    }

    const batches = this.prisma?.auditBatch?.findMany
      ? await this.prisma.auditBatch.findMany({
          where: { status: 'ANCHORED', artifactHash: { not: null }, artifactUri: { not: null } },
          orderBy: [{ toSeq: 'desc' }, { batchId: 'desc' }],
          select: { batchId: true },
        }).catch(() => [])
      : [];
    if (!batches.length) throw new ConflictException('Không có audit artifact đã neo trên blockchain để khôi phục.');

    for (const batch of batches) {
      if (localRow?.batchId && batch.batchId === localRow.batchId) continue;
      let verified: VerifiedAuditRecoveryBundle;
      try {
        let pending = cache.get(batch.batchId);
        if (!pending) {
          pending = this.verifiedBundleReader!.loadVerifiedBundle(batch.batchId);
          cache.set(batch.batchId, pending);
        }
        verified = await pending;
      } catch {
        continue;
      }

      const rows = [...verified.logs].sort((left, right) => right.seq - left.seq);
      for (const row of rows) {
        const snapshot = this.snapshotFromRow(row, target, verified.logs);
        if (!snapshot) continue;
        return {
          snapshot,
          sourceSeq: row.seq,
          sourceBatchId: batch.batchId,
          artifactHash: verified.artifactHash,
        };
      }
    }
    throw new ConflictException('Không tìm thấy snapshot đầy đủ của entity trong các artifact IPFS đã xác minh.');
  }

  snapshotFromRow(row: AuditRecoveryBundleRow, target: EntityRecreationTarget, bundleLogs?: AuditRecoveryBundleRow[]): Snapshot | null {
    if (row.entityId !== target.entityId) return null;
    const verification = verifyAuditRow({ ...row, createdAt: new Date(row.createdAt) });
    if (!verification.ok) return null;

    if (row.entity === 'AdministrativeDeletion') {
      const before = this.asObject(verification.decryptedBefore);
      const envelope = before ? recoveryEnvelope(before) : null;
      if (!before || envelope?.targetEntity !== target.entity) return null;
      return this.hasCompleteSnapshot(target.entity, before) ? before : null;
    }
    if (row.entity !== target.entity) return null;

    const after = this.asObject(verification.decryptedAfter);
    const before = this.asObject(verification.decryptedBefore);
    let candidate = after ?? before;

    if (candidate && !this.hasCompleteSnapshot(target.entity, candidate)) {
      candidate = this.synthesizeCompleteSnapshot(target.entity, candidate, row, bundleLogs);
    }

    return candidate && this.hasCompleteSnapshot(target.entity, candidate) ? candidate : null;
  }

  private synthesizeCompleteSnapshot(
    entity: RecoverableAuditEntity,
    candidate: Snapshot,
    row: AuditRecoveryBundleRow,
    bundleLogs?: AuditRecoveryBundleRow[],
  ): Snapshot {
    const synthesized: Snapshot = { ...candidate };

    if (bundleLogs && Array.isArray(bundleLogs)) {
      const peerRows = bundleLogs
        .filter((peer) => peer.entityId === row.entityId && peer.entity === entity)
        .sort((left, right) => left.seq - right.seq);
      for (const peer of peerRows) {
        const verification = verifyAuditRow({ ...peer, createdAt: new Date(peer.createdAt) });
        if (!verification.ok) continue;
        const peerSnapshot = this.asObject(verification.decryptedAfter)
          ?? this.asObject(verification.decryptedBefore);
        if (!peerSnapshot) continue;
        for (const [field, value] of Object.entries(peerSnapshot)) {
          if (synthesized[field] === undefined && value !== undefined) {
            synthesized[field] = value;
          }
        }
      }
    }

    if (row.diffJson && typeof row.diffJson === 'object') {
      const changes = (row.diffJson as { changes?: Array<{ field?: string; before?: unknown; after?: unknown }> }).changes;
      if (Array.isArray(changes)) {
        for (const change of changes) {
          if (!change.field || synthesized[change.field] !== undefined) continue;
          const value = change.after !== '[REDACTED]' ? change.after : change.before;
          if (value !== undefined && value !== '[REDACTED]') synthesized[change.field] = value;
        }
      }
    }

    return synthesized;
  }

  normalizeForRecreation(entity: RecoverableAuditEntity, source: Snapshot): Snapshot {
    const snapshot = { ...source };
    if (entity === 'Department' && snapshot.status === OperationalStatus.DELETE) snapshot.status = OperationalStatus.INACTIVE;
    if ((entity === 'StaffProfile' || entity === 'DoctorProfile') && snapshot.status === UserStatus.DELETE) snapshot.status = UserStatus.INACTIVE;
    if (entity === 'AiModelRegistry' && snapshot.status === OperationalStatus.DELETE) snapshot.status = OperationalStatus.INACTIVE;
    if (entity === 'AiModelRegistry') delete snapshot.isDeleted;
    if (entity === 'MedicalResult') delete snapshot.status;
    return snapshot;
  }

  async resolveRecoverableDependencies(
    target: EntityRecreationTarget,
    snapshot: Snapshot,
    blockers: string[],
    cache: EntityRecreationBundleCache,
    previewOne: (dependency: EntityRecreationTarget, cache: EntityRecreationBundleCache) => Promise<{ recoverable: boolean }>,
  ): Promise<{ blockers: string[]; dependencies: EntityRecreationTarget[] }> {
    let currentBlockers = [...blockers];
    const dependencies: EntityRecreationTarget[] = [];

    const tryResolve = async (blockerName: string, depEntity: RecoverableAuditEntity, depId: string | null) => {
      if (!currentBlockers.includes(blockerName) || !depId) return;
      const dependency: EntityRecreationTarget = { entity: depEntity, entityId: depId };
      const preview = await previewOne(dependency, cache);
      if (!preview.recoverable) {
        currentBlockers = currentBlockers.map((b) => (b === blockerName ? `${blockerName}_NOT_RECOVERABLE` : b));
      } else {
        currentBlockers = currentBlockers.filter((b) => b !== blockerName);
        if (!dependencies.some((d) => d.entity === depEntity && d.entityId === depId)) {
          dependencies.push(dependency);
        }
      }
    };

    await tryResolve('MISSING_PATIENT', 'Patient', parseNullableString(snapshot, 'patientId'));
    await tryResolve('MISSING_DEPARTMENT', 'Department', parseNullableString(snapshot, 'departmentId'));
    await tryResolve('MISSING_TARGET_DEPARTMENT', 'Department', parseNullableString(snapshot, 'targetDepartmentId'));
    await tryResolve('MISSING_DEPARTMENT_MANAGER', 'StaffProfile', parseNullableString(snapshot, 'managerId'));
    await tryResolve('MISSING_VISIT_STAFF', 'StaffProfile', parseNullableString(snapshot, 'staffId'));
    await tryResolve('MISSING_DOCTOR', 'DoctorProfile', parseNullableString(snapshot, 'doctorId'));
    await tryResolve('MISSING_REVIEWING_DOCTOR', 'DoctorProfile', parseNullableString(snapshot, 'reviewedByDoctorId'));
    await tryResolve('MISSING_AI_MODEL', 'AiModelRegistry', parseNullableString(snapshot, 'aiModelId'));
    await tryResolve('MISSING_VISIT', 'Visit', parseNullableString(snapshot, 'visitId'));
    await tryResolve('MISSING_MEDICAL_ORDER', 'MedicalOrder', parseNullableString(snapshot, 'orderId'));
    await tryResolve('MISSING_AI_DIAGNOSIS', 'AiDiagnosis', parseNullableString(snapshot, 'aiDiagnosisId'));

    return { blockers: currentBlockers, dependencies };
  }

  private hasCompleteSnapshot(entity: RecoverableAuditEntity, value: Snapshot): boolean {
    return REQUIRED_SNAPSHOT_FIELDS[entity].every((field) => Object.prototype.hasOwnProperty.call(value, field));
  }

  private asObject(value: unknown): Snapshot | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Snapshot : null;
  }
}
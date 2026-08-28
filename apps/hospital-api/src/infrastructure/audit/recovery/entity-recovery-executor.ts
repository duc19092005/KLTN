import { ConflictException, Injectable, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLoggerService } from '../logging/audit-logger.service';
import { AuditAnchorService } from '../anchoring/audit-anchor.service';
import { verifyAuditRow } from '../logging/audit-verification.util';
import { VerifiedAuditBundleReader } from './verified-audit-bundle.reader';
import { EntityRecreationBundleCache, EntityRecreationService } from './entity-recreation.service';
import { EntityRecoveryTarget, RecoverableAuditEntity } from './entity-registry.config';
import { loadLiveEntitySnapshot, restoreEntitySnapshotData } from './entity-snapshot.handler';
import { EntityIntegrityEvaluator } from './entity-integrity-evaluator';

type Snapshot = Record<string, unknown>;

@Injectable()
export class EntityRecoveryExecutor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLoggerService,
    private readonly anchor: AuditAnchorService,
    private readonly evaluator: EntityIntegrityEvaluator,
    @Optional() private readonly verifiedBundleReader?: VerifiedAuditBundleReader,
    @Optional() private readonly recreation?: EntityRecreationService,
  ) {}

  async recoverOne(
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

      if (!this.verifiedBundleReader) {
        throw new ConflictException('Audit log local có dấu hiệu bị sửa đổi và dịch vụ IPFS recovery chưa sẵn sàng.');
      }

      const verifiedBundle = await this.verifiedBundleReader.loadVerifiedBundle(row.batchId);
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

    const snapshot = this.evaluator.effectiveRecoverySnapshot(target.entity, sourceSnapshot, liveSnapshot);
    if (this.evaluator.snapshotsEqual(snapshot, liveSnapshot)) {
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
      const transactionSnapshot = this.evaluator.effectiveRecoverySnapshot(target.entity, sourceSnapshot, current);
      if (this.evaluator.snapshotsEqual(transactionSnapshot, current)) return;

      await restoreEntitySnapshotData(tx, target.entity, target.entityId, transactionSnapshot);
      const restored = await loadLiveEntitySnapshot(tx, target.entity, target.entityId);
      if (!restored) throw new ConflictException('Không đọc lại được bản ghi sau khôi phục.');
      if (!this.evaluator.snapshotsEqual(transactionSnapshot, restored)) {
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
      if (this.evaluator.hasCompleteSnapshot(entity, verification.decryptedAfter)) return row;
    }
    return null;
  }

  private requireCompleteSnapshot(entity: RecoverableAuditEntity, value: unknown): Snapshot {
    if (!this.evaluator.hasCompleteSnapshot(entity, value)) throw new ConflictException('Snapshot audit không đủ trường bắt buộc để khôi phục an toàn.');
    return value;
  }
}
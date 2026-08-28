import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditArtifactService, AuditRecoveryBundleRow } from '../ipfs/audit-artifact.service';

@Injectable()
export class AuditBatchArtifactPublisher {
  constructor(
    private readonly prisma: PrismaService,
    private readonly artifacts: AuditArtifactService,
  ) {}

  assertReady(): void {
    this.artifacts.assertReady();
  }

  async loadRecoveryBundleRows(fromSeq: number, toSeq: number): Promise<AuditRecoveryBundleRow[]> {
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
      visitId: row.visitId,
      medicalOrderId: row.medicalOrderId,
      medicalResultId: row.medicalResultId,
      aiQualityId: row.aiQualityId,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async createAndUploadBatchArtifact(params: {
    batchId: number;
    merkleRoot: string;
    leafCount: number;
    fromSeq: number;
    toSeq: number;
    algorithmVersion: string;
  }) {
    const logs = await this.loadRecoveryBundleRows(params.fromSeq, params.toSeq);
    return this.artifacts.createAndUpload({
      schema: 'KLTN_AUDIT_RECOVERY_BUNDLE_V1',
      batch: {
        batchId: params.batchId,
        merkleRoot: params.merkleRoot,
        leafCount: params.leafCount,
        fromSeq: params.fromSeq,
        toSeq: params.toSeq,
        algorithmVersion: params.algorithmVersion,
      },
      logs,
    });
  }
}
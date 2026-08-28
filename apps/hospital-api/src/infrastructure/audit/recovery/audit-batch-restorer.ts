import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { AuditArtifactService, AuditRecoveryBundleRow } from '../ipfs/audit-artifact.service';
import { AuditLoggerService } from '../logging/audit-logger.service';
import { computeMerkleRootForAlgorithm, rootToBytes32 } from '../crypto/merkle.util';
import { verifyAuditRow, verifyAuditRowLight } from '../logging/audit-verification.util';

@Injectable()
export class AuditBatchRestorer {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchain: BlockchainService,
    private readonly artifacts: AuditArtifactService,
    private readonly audit: AuditLoggerService,
  ) {}

  async recoverBatchDirectFromChain(batchId: number, adminId: string | null, reason: string): Promise<void> {
    const checkpoint = await this.blockchain.getAuditCheckpoint(batchId);
    if (!checkpoint?.committed || !checkpoint.artifactUri || !checkpoint.artifactHash) {
      throw new Error(`Batch ${batchId} không có checkpoint hợp lệ trên Blockchain.`);
    }

    const bundle = await this.artifacts.downloadAndDecrypt(
      batchId,
      checkpoint.artifactUri,
      checkpoint.artifactHash,
    );
    const expected = this.expectedBundleMetadata(bundle, checkpoint, batchId);
    this.validateBundle(bundle.logs, expected);

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('blockchain_logger_chain'))`;
      await tx.$executeRaw`SELECT set_config('app.audit_recovery_authorized', 'true', true)`;
      await tx.$executeRaw`SET LOCAL session_replication_role = 'replica'`;

      const artifactIds = bundle.logs.map((row) => row.id);
      const artifactSequences = bundle.logs.map((row) => row.seq);
      const localCandidates = await tx.blockchainLogger.findMany({
        where: {
          OR: [
            { seq: { in: artifactSequences } },
            { id: { in: artifactIds } },
            { batchId },
          ],
        },
        select: { id: true, seq: true, entryHash: true, batchId: true },
      });
      const artifactBySeq = new Map(bundle.logs.map((row) => [row.seq, row]));
      const artifactById = new Map(bundle.logs.map((row) => [row.id, row]));
      const exactRows = new Set<string>();
      const conflicts: typeof localCandidates = [];

      for (const local of localCandidates) {
        const bySeq = local.seq == null ? undefined : artifactBySeq.get(local.seq);
        const byId = artifactById.get(local.id);
        const artifactRow = bySeq ?? byId;
        const isExact = Boolean(
          artifactRow
          && local.id === artifactRow.id
          && local.seq === artifactRow.seq
          && local.entryHash === artifactRow.entryHash,
        );
        if (isExact) exactRows.add(local.id);
        else conflicts.push(local);
      }

      if (conflicts.length > 0) {
        await tx.blockchainLogger.deleteMany({
          where: { id: { in: conflicts.map((row) => row.id) } },
        });
      }

      for (const row of bundle.logs) {
        const input = this.toCreateInput(row, batchId, null, null);
        await tx.blockchainLogger.upsert({
          where: { id: row.id },
          create: input,
          update: input,
        });
      }

      await tx.auditBatch.upsert({
        where: { batchId },
        create: {
          batchId,
          merkleRoot: expected.merkleRoot,
          leafCount: expected.leafCount,
          fromSeq: expected.fromSeq,
          toSeq: expected.toSeq,
          algorithmVersion: expected.algorithmVersion,
          contractVersion: 'AUDIT_ANCHOR_CHECKPOINT_V2',
          artifactHash: checkpoint.artifactHash,
          artifactUri: checkpoint.artifactUri,
          artifactCid: checkpoint.artifactUri.startsWith('ipfs://')
            ? checkpoint.artifactUri.slice('ipfs://'.length)
            : null,
          status: 'ANCHORED',
          anchoredAt: new Date(checkpoint.timestamp * 1000),
          recoveredAt: new Date(),
          error: null,
        },
        update: {
          merkleRoot: expected.merkleRoot,
          leafCount: expected.leafCount,
          fromSeq: expected.fromSeq,
          toSeq: expected.toSeq,
          algorithmVersion: expected.algorithmVersion,
          contractVersion: 'AUDIT_ANCHOR_CHECKPOINT_V2',
          artifactHash: checkpoint.artifactHash,
          artifactUri: checkpoint.artifactUri,
          artifactCid: checkpoint.artifactUri.startsWith('ipfs://')
            ? checkpoint.artifactUri.slice('ipfs://'.length)
            : null,
          status: 'ANCHORED',
          anchoredAt: new Date(checkpoint.timestamp * 1000),
          recoveredAt: new Date(),
          error: null,
        },
      });

      const restored = await tx.blockchainLogger.findMany({
        where: { batchId, seq: { gte: expected.fromSeq, lte: expected.toSeq } },
        orderBy: { seq: 'asc' },
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
      if (restored.length !== bundle.logs.length) {
        throw new Error(`Batch ${batchId} restore count mismatch.`);
      }
      for (let index = 0; index < restored.length; index += 1) {
        const local = restored[index];
        const artifact = bundle.logs[index];
        if (local.id !== artifact.id || local.seq !== artifact.seq || local.entryHash !== artifact.entryHash) {
          throw new Error(`Batch ${batchId} immutable membership mismatch at seq ${artifact.seq}.`);
        }
        if (!verifyAuditRowLight(local).ok) {
          throw new Error(`Batch ${batchId} restored row ${artifact.seq} failed hash verification.`);
        }
      }
      const restoredRoot = computeMerkleRootForAlgorithm(
        restored.map((row) => row.entryHash!),
        expected.algorithmVersion,
      );
      if (rootToBytes32(restoredRoot).toLowerCase() !== rootToBytes32(checkpoint.root).toLowerCase()) {
        throw new Error(`Batch ${batchId} restored Merkle root does not match its checkpoint.`);
      }
    });

    try {
      await this.audit.recordV2({
        entity: 'AuditBatch',
        entityId: String(batchId),
        action: 'AUDIT_RECOVERY_EXECUTED',
        actorId: adminId || null,
        before: null,
        after: { batchId, restoredCount: bundle.logs.length, status: 'RECOVERED' },
        metadata: {
          batchId,
          reason,
          artifactHash: checkpoint.artifactHash,
          actorType: adminId ? 'ADMIN_USER' : 'SYSTEM_WATCHDOG',
        },
      });
    } catch (auditError) {
      console.error(`[AUDIT RECOVERY] Batch #${batchId} restored but recovery event append failed:`, auditError);
    }
  }

  private expectedBundleMetadata(
    bundle: { batch: { batchId: number; merkleRoot: string; fromSeq: number; toSeq: number; leafCount: number; algorithmVersion: string } },
    checkpoint: { root: string; fromSeq: number; toSeq: number; leafCount: number },
    expectedBatchId = bundle.batch.batchId,
  ) {
    if (bundle.batch.batchId !== expectedBatchId) {
      throw new BadRequestException('Recovery bundle batch id does not match the requested checkpoint.');
    }
    if (
      bundle.batch.fromSeq !== checkpoint.fromSeq
      || bundle.batch.toSeq !== checkpoint.toSeq
      || bundle.batch.leafCount !== checkpoint.leafCount
    ) {
      throw new BadRequestException('Recovery bundle metadata does not match the blockchain checkpoint.');
    }
    if (rootToBytes32(bundle.batch.merkleRoot).toLowerCase() !== rootToBytes32(checkpoint.root).toLowerCase()) {
      throw new BadRequestException('Recovery bundle root does not match the blockchain checkpoint.');
    }
    return {
      batchId: bundle.batch.batchId,
      merkleRoot: bundle.batch.merkleRoot,
      fromSeq: bundle.batch.fromSeq,
      toSeq: bundle.batch.toSeq,
      leafCount: bundle.batch.leafCount,
      algorithmVersion: bundle.batch.algorithmVersion,
      onChainRoot: checkpoint.root,
      onChainLeafCount: checkpoint.leafCount,
    };
  }

  private validateBundle(
    rows: AuditRecoveryBundleRow[],
    expected: {
      batchId: number;
      merkleRoot: string;
      fromSeq: number;
      toSeq: number;
      leafCount: number;
      algorithmVersion: string;
      onChainRoot: string;
      onChainLeafCount: number;
    },
  ): void {
    if (rows.length !== expected.leafCount || rows.length !== expected.onChainLeafCount) {
      throw new BadRequestException('Recovery bundle leaf count does not match the blockchain checkpoint.');
    }
    if (expected.toSeq - expected.fromSeq + 1 !== rows.length) {
      throw new BadRequestException('Recovery bundle sequence range is incomplete.');
    }
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      if (row.seq !== expected.fromSeq + index) throw new BadRequestException(`Recovery bundle is missing sequence ${expected.fromSeq + index}.`);
      if (index > 0 && row.prevHash !== rows[index - 1].entryHash) {
        throw new BadRequestException(`Recovery bundle hash chain breaks at sequence ${row.seq}.`);
      }
      const verification = verifyAuditRow({ ...row, createdAt: new Date(row.createdAt) });
      if (!verification.ok) throw new BadRequestException(`Recovery bundle row ${row.seq} failed hash verification.`);
    }

    const root = computeMerkleRootForAlgorithm(rows.map((row) => row.entryHash), expected.algorithmVersion);
    if (root !== expected.merkleRoot || rootToBytes32(root).toLowerCase() !== expected.onChainRoot.toLowerCase()) {
      throw new BadRequestException('Recovery bundle Merkle root does not match the blockchain checkpoint.');
    }
  }

  private toCreateInput(
    row: AuditRecoveryBundleRow,
    batchId: number,
    txHash: string | null,
    blockNumber: number | null,
  ): Prisma.BlockchainLoggerUncheckedCreateInput {
    return {
      id: row.id,
      eventId: row.eventId,
      actorId: row.actorId,
      action: row.action,
      entity: row.entity,
      entityId: row.entityId,
      metadata: this.json(row.metadata),
      dataHash: row.dataHash,
      dataSalt: row.dataSalt,
      beforeJson: this.json(row.beforeJson),
      afterJson: this.json(row.afterJson),
      beforeHash: row.beforeHash,
      afterHash: row.afterHash,
      diffHash: row.diffHash,
      hashVersion: row.hashVersion,
      beforeEncrypted: this.json(row.beforeEncrypted),
      afterEncrypted: this.json(row.afterEncrypted),
      encryptionVersion: row.encryptionVersion,
      encryptionKeyId: row.encryptionKeyId,
      diffJson: this.json(row.diffJson),
      fieldsChanged: this.json(row.fieldsChanged),
      onChainStatus: 'ANCHORED',
      txHash,
      blockNumber,
      seq: row.seq,
      prevHash: row.prevHash,
      entryHash: row.entryHash,
      batchId,
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
      createdAt: new Date(row.createdAt),
    };
  }

  private json(value: unknown): Prisma.InputJsonValue | Prisma.NullTypes.JsonNull {
    return value == null ? Prisma.JsonNull : value as Prisma.InputJsonValue;
  }
}
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { AuditArtifactService, AuditRecoveryBundleRow } from './audit-artifact.service';
import { AuditAnchorService } from './audit-anchor.service';
import { AuditLoggerService } from './audit-logger.service';
import { computeMerkleRootForAlgorithm, rootToBytes32 } from './merkle.util';
import { verifyAuditRow } from './audit-verification.util';

export interface VerifiedAuditRecoveryBundle {
  batchId: number;
  artifactHash: string;
  artifactUri: string;
  merkleRoot: string;
  logs: AuditRecoveryBundleRow[];
}

@Injectable()
export class AuditRecoveryService {
  private readonly runningBatches = new Set<number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchain: BlockchainService,
    private readonly artifacts: AuditArtifactService,
    private readonly anchor: AuditAnchorService,
    private readonly audit: AuditLoggerService,
  ) {}

  /**
   * Read an anchored recovery artifact without mutating PostgreSQL. The returned
   * rows have been authenticated against both the IPFS artifact hash and the
   * blockchain checkpoint, then re-verified as a complete hash/Merkle chain.
   */
  async loadVerifiedBundle(batchId: number): Promise<VerifiedAuditRecoveryBundle> {
    if (!Number.isSafeInteger(batchId) || batchId <= 0) throw new BadRequestException('Invalid audit batch id.');
    const batch = await this.prisma.auditBatch.findUnique({ where: { batchId } });
    if (!batch) throw new NotFoundException('Audit batch was not found.');
    if (batch.status !== 'ANCHORED') throw new BadRequestException('Only anchored audit batches can be used for recovery.');
    if (batch.fromSeq == null || batch.toSeq == null) throw new BadRequestException('The audit batch sequence range is incomplete.');

    const checkpoint = await this.blockchain.getAuditCheckpoint(batchId);
    if (!checkpoint?.committed) throw new BadRequestException('The batch has no committed blockchain checkpoint.');
    if (!checkpoint.artifactUri || !checkpoint.artifactHash) {
      throw new BadRequestException('The blockchain checkpoint has no recovery artifact.');
    }

    const bundle = await this.artifacts.downloadAndDecrypt(
      batchId,
      checkpoint.artifactUri,
      checkpoint.artifactHash,
    );
    this.validateBundle(bundle.logs, {
      batchId,
      merkleRoot: batch.merkleRoot,
      fromSeq: batch.fromSeq,
      toSeq: batch.toSeq,
      leafCount: batch.leafCount,
      algorithmVersion: batch.algorithmVersion,
      onChainRoot: checkpoint.root,
      onChainLeafCount: checkpoint.leafCount,
    });

    return {
      batchId,
      artifactHash: checkpoint.artifactHash,
      artifactUri: checkpoint.artifactUri,
      merkleRoot: bundle.batch.merkleRoot,
      logs: bundle.logs,
    };
  }

  async recover(batchId: number, adminId: string, reason: string): Promise<{
    batchId: number;
    status: 'RECOVERED';
    restoredCount: number;
    merkleRoot: string;
    artifactHash: string;
    completedAt: string;
  }> {
    if (!Number.isSafeInteger(batchId) || batchId <= 0) throw new BadRequestException('Invalid audit batch id.');
    if (this.runningBatches.has(batchId)) throw new ConflictException('This audit batch is already being recovered.');
    this.runningBatches.add(batchId);

    const recovery = await this.prisma.auditRecovery.create({
      data: { batchId, requestedById: adminId, reason: reason.trim() },
    });

    try {
      const batch = await this.prisma.auditBatch.findUnique({ where: { batchId } });
      if (!batch) throw new NotFoundException('Audit batch was not found.');
      if (batch.status !== 'ANCHORED') throw new BadRequestException('Only anchored audit batches can be recovered.');

      const checkpoint = await this.blockchain.getAuditCheckpoint(batchId);
      if (!checkpoint?.committed) throw new BadRequestException('The batch has no committed blockchain checkpoint.');
      if (!checkpoint.artifactUri || !checkpoint.artifactHash) {
        throw new BadRequestException('The blockchain checkpoint has no recovery artifact.');
      }

      const currentRows = await this.prisma.blockchainLogger.findMany({
        where: { batchId },
        orderBy: { seq: 'asc' },
      });
      const currentRowsAreInternallyValid = currentRows.every((row) => verifyAuditRow(row).ok);
      if (
        currentRowsAreInternallyValid
        && currentRows.length === checkpoint.leafCount
        && currentRows.every((row) => Boolean(row.entryHash))
      ) {
        const currentRoot = computeMerkleRootForAlgorithm(
          currentRows.map((row) => row.entryHash!),
          batch.algorithmVersion,
        );
        if (rootToBytes32(currentRoot).toLowerCase() === checkpoint.root.toLowerCase()) {
          throw new BadRequestException('The database batch already matches its blockchain checkpoint.');
        }
      }

      const verifiedBundle = await this.loadVerifiedBundle(batchId);
      const bundle = {
        schema: 'KLTN_AUDIT_RECOVERY_BUNDLE_V1' as const,
        batch: {
          batchId,
          merkleRoot: batch.merkleRoot,
          leafCount: batch.leafCount,
          fromSeq: batch.fromSeq!,
          toSeq: batch.toSeq!,
          algorithmVersion: batch.algorithmVersion,
        },
        logs: verifiedBundle.logs,
      };

      const following = await this.prisma.blockchainLogger.findFirst({
        where: { seq: bundle.batch.toSeq + 1 },
        select: { prevHash: true },
      });
      const lastRecoveredHash = bundle.logs.at(-1)!.entryHash;
      if (following && following.prevHash !== lastRecoveredHash) {
        throw new BadRequestException('The next audit row does not link to the trusted recovery bundle.');
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.auditRecoveryStageRow.createMany({
          data: bundle.logs.map((row) => ({
            recoveryId: recovery.id,
            seq: row.seq,
            entryHash: row.entryHash,
            payload: row as unknown as Prisma.InputJsonValue,
          })),
        });

        await tx.$executeRaw`SELECT set_config('app.audit_recovery_authorized', 'true', true)`;
        const recoveredLogIds = bundle.logs.map((row) => row.id);
        // Kafka receipts/outbox rows are delivery metadata, not part of the anchored audit
        // content. They reference BlockchainLogger with NoAction and must be removed before
        // replacing the damaged rows. Recovered rows are already anchored, so they must not be
        // republished to Kafka.
        await tx.auditKafkaReceipt.deleteMany({ where: { auditLogId: { in: recoveredLogIds } } });
        await tx.auditOutbox.deleteMany({ where: { auditLogId: { in: recoveredLogIds } } });
        await tx.blockchainLogger.deleteMany({
          where: { seq: { gte: bundle.batch.fromSeq, lte: bundle.batch.toSeq } },
        });
        for (const row of bundle.logs) {
          await tx.blockchainLogger.create({ data: this.toCreateInput(row, batchId, batch.txHash, batch.blockNumber) });
        }

        await tx.auditBatch.update({
          where: { batchId },
          data: {
            merkleRoot: bundle.batch.merkleRoot,
            leafCount: bundle.batch.leafCount,
            fromSeq: bundle.batch.fromSeq,
            toSeq: bundle.batch.toSeq,
            algorithmVersion: bundle.batch.algorithmVersion,
            artifactHash: checkpoint.artifactHash,
            artifactUri: checkpoint.artifactUri,
            artifactCid: checkpoint.artifactUri.slice('ipfs://'.length),
            status: 'ANCHORED',
            recoveredAt: new Date(),
            error: null,
          },
        });

        await tx.auditRecovery.update({
          where: { id: recovery.id },
          data: {
            status: 'COMPLETED',
            restoredCount: bundle.logs.length,
            artifactHash: checkpoint.artifactHash,
            merkleRoot: bundle.batch.merkleRoot,
            completedAt: new Date(),
          },
        });
        await tx.auditRecoveryStageRow.deleteMany({ where: { recoveryId: recovery.id } });
      });

      const verified = await this.anchor.verifyAllAnchoredBatchesAgainstChain();
      if (!verified.ok) {
        throw new Error(`Post-recovery verification failed: ${verified.reason ?? 'unknown integrity error'}`);
      }

      await this.audit.recordV2({
        entity: 'AuditBatch',
        entityId: String(batchId),
        action: 'AUDIT_RECOVERY_EXECUTED',
        actorId: adminId,
        before: null,
        after: { batchId, restoredCount: bundle.logs.length, status: 'RECOVERED' },
        metadata: { batchId, reason, artifactHash: checkpoint.artifactHash },
      });

      const completedAt = new Date().toISOString();
      return {
        batchId,
        status: 'RECOVERED',
        restoredCount: bundle.logs.length,
        merkleRoot: bundle.batch.merkleRoot,
        artifactHash: checkpoint.artifactHash,
        completedAt,
      };
    } catch (error) {
      const failureReason = error instanceof Error ? error.message : 'Audit recovery failed.';
      await this.prisma.auditRecovery.update({
        where: { id: recovery.id },
        data: { status: 'FAILED', failureReason, completedAt: new Date() },
      }).catch(() => undefined);
      throw error;
    } finally {
      this.runningBatches.delete(batchId);
    }
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
      aiQualityId: row.aiQualityId,
      createdAt: new Date(row.createdAt),
    };
  }

  private json(value: unknown): Prisma.InputJsonValue | Prisma.NullTypes.JsonNull {
    return value == null ? Prisma.JsonNull : value as Prisma.InputJsonValue;
  }
}

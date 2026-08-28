import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { computeMerkleRootForAlgorithm, MERKLE_SHA256_STRING_V1, rootToBytes32 } from '../crypto/merkle.util';
import { verifyAuditRowLight } from '../logging/audit-verification.util';

@Injectable()
export class AuditBatchScanner {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchain: BlockchainService,
  ) {}

  async scanCheckpointsAgainstLocalDb(fromBatchId: number, toBatchId: number): Promise<{
    scannedCount: number;
    targetBatchIds: number[];
    localBatchesCount: number;
    anomalies: Array<{ batchId: number; reason: string }>;
  }> {
    const checkpoints = await this.blockchain.getAuditCheckpointsRange(fromBatchId, toBatchId);
    const scannedCount = checkpoints.length;
    const anomalies: Array<{ batchId: number; reason: string }> = [];
    const targetBatchIds: number[] = [];

    const localBatches = await this.prisma.auditBatch.findMany({
      select: {
        batchId: true,
        merkleRoot: true,
        status: true,
        fromSeq: true,
        toSeq: true,
        leafCount: true,
        algorithmVersion: true,
      },
    });
    const localBatchMap = new Map(localBatches.map((b) => [b.batchId, b]));

    for (const cp of checkpoints) {
      if (!cp.committed) continue;
      const local = localBatchMap.get(cp.batchId);

      if (!local || local.status !== 'ANCHORED') {
        targetBatchIds.push(cp.batchId);
        anomalies.push({ batchId: cp.batchId, reason: `Batch #${cp.batchId} bị THIẾU trong DB local.` });
        continue;
      }

      const isHeaderMatch = rootToBytes32(local.merkleRoot).toLowerCase() === rootToBytes32(cp.root).toLowerCase();
      let isLogsIntact = true;

      if (local.fromSeq != null && local.toSeq != null) {
        const logsInBatch = await this.prisma.blockchainLogger.findMany({
          where: { batchId: local.batchId, seq: { gte: local.fromSeq, lte: local.toSeq }, entryHash: { not: null } },
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

        const expectedCount = Number(cp.leafCount) || local.leafCount || (local.toSeq - local.fromSeq + 1);
        if (logsInBatch.length !== expectedCount) {
          isLogsIntact = false;
          anomalies.push({ batchId: cp.batchId, reason: `Batch #${cp.batchId} bị THIẾU DỮ LIỆU LOG (${logsInBatch.length}/${expectedCount} logs).` });
        } else {
          const isEveryRowVerified = logsInBatch.every((l) => verifyAuditRowLight(l).ok);
          if (!isEveryRowVerified) {
            isLogsIntact = false;
            anomalies.push({ batchId: cp.batchId, reason: `Batch #${cp.batchId} có bản ghi log bị sửa đổi.` });
          } else {
            const recomputedRoot = computeMerkleRootForAlgorithm(
              logsInBatch.map((l) => l.entryHash!),
              local.algorithmVersion ?? MERKLE_SHA256_STRING_V1,
            );
            if (rootToBytes32(recomputedRoot).toLowerCase() !== rootToBytes32(cp.root).toLowerCase()) {
              isLogsIntact = false;
              anomalies.push({ batchId: cp.batchId, reason: `Batch #${cp.batchId} bị SỬA ĐỔI MÃ HASH TRONG LOGS.` });
            }
          }
        }
      } else {
        isLogsIntact = false;
        anomalies.push({ batchId: cp.batchId, reason: `Batch #${cp.batchId} thiếu fromSeq/toSeq trong DB local.` });
      }

      if (!isHeaderMatch || !isLogsIntact) {
        if (!targetBatchIds.includes(cp.batchId)) targetBatchIds.push(cp.batchId);
        if (!isHeaderMatch) {
          anomalies.push({ batchId: cp.batchId, reason: `Batch #${cp.batchId} bị SỬA ĐỔI MÃ HASH HEADER.` });
        }
      }
    }

    return {
      scannedCount,
      targetBatchIds,
      localBatchesCount: localBatches.length,
      anomalies,
    };
  }
}
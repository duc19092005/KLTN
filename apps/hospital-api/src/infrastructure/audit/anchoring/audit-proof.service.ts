import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BlockchainService } from '../../blockchain/blockchain.service';
import {
  buildMerkleProofForAlgorithm,
  computeMerkleRootForAlgorithm,
  MERKLE_SHA256_STRING_V1,
  rootToBytes32,
  verifyMerkleProofForAlgorithm,
} from '../crypto/merkle.util';

@Injectable()
export class AuditProofService {
  private readonly onChainRootCache = new Map<number, string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchain: BlockchainService,
  ) {}

  clearCache(): void {
    this.onChainRootCache.clear();
  }

  async getInclusionProof(
    seq: number,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<{
    seq: number;
    batchId: number;
    entryHash: string;
    proof: string[];
    merkleRoot: string;
    onChainRoot: string | null;
    verified: boolean;
  } | null> {
    const log = await client.blockchainLogger.findFirst({
      where: { seq },
      select: { seq: true, batchId: true, entryHash: true },
    });
    if (!log || log.batchId == null || !log.entryHash) return null;

    const batchLogs = await client.blockchainLogger.findMany({
      where: { batchId: log.batchId, seq: { not: null }, entryHash: { not: null } },
      orderBy: { seq: 'asc' },
      select: { seq: true, entryHash: true },
    });
    const entryHashes = batchLogs.map((l) => l.entryHash!);
    const index = batchLogs.findIndex((l) => l.seq === seq);
    if (index < 0) return null;

    const batch = await client.auditBatch.findUnique({
      where: { batchId: log.batchId },
      select: { algorithmVersion: true },
    });
    const algorithm = batch?.algorithmVersion ?? MERKLE_SHA256_STRING_V1;
    const proof = buildMerkleProofForAlgorithm(entryHashes, index, algorithm);
    const merkleRoot = computeMerkleRootForAlgorithm(entryHashes, algorithm);
    let onChainRoot = this.onChainRootCache.get(log.batchId) ?? null;
    if (!onChainRoot) {
      onChainRoot = await this.blockchain.getAuditRoot(log.batchId);
      if (onChainRoot) {
        this.onChainRootCache.set(log.batchId, onChainRoot);
      }
    }
    const verified =
      verifyMerkleProofForAlgorithm(log.entryHash, proof, merkleRoot, algorithm) &&
      onChainRoot != null &&
      rootToBytes32(merkleRoot).toLowerCase() === onChainRoot.toLowerCase();

    return { seq, batchId: log.batchId, entryHash: log.entryHash, proof, merkleRoot, onChainRoot, verified };
  }

  async getLatestVerifiedCheckpointBefore(
    targetSeq: number,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<{ batchId: number; fromSeq: number; toSeq: number; entryHash: string } | null> {
    const batch = await client.auditBatch.findFirst({
      where: { status: 'ANCHORED', toSeq: { lt: targetSeq } },
      orderBy: { toSeq: 'desc' },
      select: {
        batchId: true,
        merkleRoot: true,
        fromSeq: true,
        toSeq: true,
        leafCount: true,
        algorithmVersion: true,
      },
    });
    if (!batch || batch.fromSeq == null || batch.toSeq == null) return null;

    const checkpoint = await this.blockchain.getAuditCheckpoint(batch.batchId);
    if (
      !checkpoint?.committed ||
      checkpoint.fromSeq !== batch.fromSeq ||
      checkpoint.toSeq !== batch.toSeq ||
      checkpoint.leafCount !== batch.leafCount ||
      rootToBytes32(checkpoint.root).toLowerCase() !== rootToBytes32(batch.merkleRoot).toLowerCase()
    ) {
      throw new Error(`AUDIT_CHECKPOINT_UNVERIFIED: batch ${batch.batchId} metadata does not match blockchain.`);
    }

    const logs = await client.blockchainLogger.findMany({
      where: { seq: { gte: batch.fromSeq, lte: batch.toSeq }, entryHash: { not: null } },
      orderBy: { seq: 'asc' },
      select: { seq: true, entryHash: true },
    });
    if (logs.length !== batch.leafCount || logs[logs.length - 1]?.seq !== batch.toSeq) {
      throw new Error(`AUDIT_CHECKPOINT_UNVERIFIED: batch ${batch.batchId} local leaves are incomplete.`);
    }
    const recomputedRoot = computeMerkleRootForAlgorithm(
      logs.map((log) => log.entryHash!),
      batch.algorithmVersion ?? MERKLE_SHA256_STRING_V1,
    );
    if (rootToBytes32(recomputedRoot).toLowerCase() !== rootToBytes32(checkpoint.root).toLowerCase()) {
      throw new Error(`AUDIT_CHECKPOINT_UNVERIFIED: batch ${batch.batchId} Merkle root mismatch.`);
    }

    return {
      batchId: batch.batchId,
      fromSeq: batch.fromSeq,
      toSeq: batch.toSeq,
      entryHash: logs[logs.length - 1].entryHash!,
    };
  }
}
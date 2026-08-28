import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { BlockchainService } from '../../../../infrastructure/blockchain/blockchain.service';
import { AuthUser } from '../../../../common/types/auth-user.type';
import { AuditPresenter, AuditBatchRows } from '../presenters/audit.presenter';
import { AuditSubjectResolverService } from '../services/audit-subject-resolver.service';
import type { AuditBatch, Prisma } from '@prisma/client';

const UNFINALIZED_AUDIT_BATCH_STATUSES = new Set([
  'PENDING',
  'PREPARING',
  'ARTIFACT_READY',
  'ON_CHAIN_CONFIRMED',
]);

type AuditBatchMembership = Pick<AuditBatch, 'batchId' | 'fromSeq' | 'toSeq' | 'status'>;

@Injectable()
export class ListAuditBatchesQuery {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchain: BlockchainService,
    private readonly presenter: AuditPresenter,
    private readonly resolver: AuditSubjectResolverService,
  ) {}

  async execute(pageRaw?: string, limitRaw?: string, sortByRaw?: string, sortRaw?: string) {
    const page = Math.max(Number(pageRaw) || 1, 1);
    const limit = Math.min(Math.max(Number(limitRaw) || 10, 1), 100);
    const skip = (page - 1) * limit;
    const sortDir: 'asc' | 'desc' = sortRaw === 'asc' ? 'asc' : 'desc';
    const sortBy = (sortByRaw || 'batchId').toLowerCase();

    const localBatches = await this.prisma.auditBatch.findMany({
      select: {
        id: true,
        batchId: true,
        merkleRoot: true,
        leafCount: true,
        fromSeq: true,
        toSeq: true,
        status: true,
        algorithmVersion: true,
        contractVersion: true,
        artifactHash: true,
        artifactUri: true,
        txHash: true,
        blockNumber: true,
        error: true,
        createdAt: true,
        anchoredAt: true,
        recoveredAt: true,
      },
    });

    const localMap = new Map(localBatches.map((b) => [b.batchId, b]));
    const allMergedItems: any[] = [...localBatches];

    try {
      const latestOnChain = await this.blockchain.getLatestAuditBatchId();
      if (latestOnChain && latestOnChain > 0) {
        const missingOnChainIds: number[] = [];
        for (let bId = 1; bId <= latestOnChain; bId++) {
          if (!localMap.has(bId)) missingOnChainIds.push(bId);
        }

        if (missingOnChainIds.length > 0) {
          const checkpoints = await this.blockchain.getAuditCheckpointsRange(1, latestOnChain);
          for (const cp of checkpoints) {
            if (cp.committed && !localMap.has(cp.batchId)) {
              allMergedItems.push({
                id: `missing-batch-${cp.batchId}`,
                batchId: cp.batchId,
                merkleRoot: cp.root,
                leafCount: cp.leafCount,
                fromSeq: cp.fromSeq,
                toSeq: cp.toSeq,
                status: 'MISSING',
                algorithmVersion: 'MERKLE_SHA256_STRING_V1',
                contractVersion: 'AUDIT_ANCHOR_CHECKPOINT_V2',
                artifactHash: cp.artifactHash,
                artifactUri: cp.artifactUri,
                txHash: null,
                blockNumber: null,
                error: 'Lô bị xóa khỏi Database local',
                createdAt: new Date(cp.timestamp * 1000).toISOString(),
                anchoredAt: new Date(cp.timestamp * 1000).toISOString(),
                recoveredAt: null,
                isMissingFromLocal: true,
              });
            }
          }
        }
      }
    } catch {
      // Fallback to local DB if blockchain read fails
    }

    allMergedItems.sort((a, b) => {
      if (sortBy === 'time' || sortBy === 'anchoredat' || sortBy === 'createdat') {
        const timeA = new Date(a.anchoredAt || a.createdAt).getTime();
        const timeB = new Date(b.anchoredAt || b.createdAt).getTime();
        return sortDir === 'asc' ? timeA - timeB : timeB - timeA;
      }
      return sortDir === 'asc' ? a.batchId - b.batchId : b.batchId - a.batchId;
    });

    const total = allMergedItems.length;
    const paginatedItems = allMergedItems.slice(skip, skip + limit);

    const rowsByBatch = await this.loadBatchRows(paginatedItems.filter((i) => !i.isMissingFromLocal));
    const contentByBatch = await this.presenter.buildBatchContentSummaries(rowsByBatch);
    const integrityByBatch = this.presenter.buildBatchIntegritySummaries(rowsByBatch);

    return {
      items: paginatedItems.map(({ artifactUri, isMissingFromLocal, ...item }) => ({
        ...item,
        artifactAvailable: Boolean(artifactUri && item.artifactHash),
        contentSummary: isMissingFromLocal
          ? [{ entity: 'AuditBatch', label: 'Bị xóa khỏi DB local', count: item.leafCount || 1 }]
          : (contentByBatch.get(item.batchId) ?? []),
        integrity: isMissingFromLocal
          ? { status: 'CORRUPTED', verified: 0, tampered: 1, pending: 0, total: 1 }
          : (integrityByBatch.get(item.batchId) ?? {
              status: 'PENDING',
              verified: 0,
              tampered: 0,
              pending: 0,
              total: 0,
            }),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getBatchDetail(batchId: number, user?: AuthUser) {
    const batch = await this.prisma.auditBatch.findUnique({ where: { batchId } });
    if (!batch) throw new NotFoundException('Không tìm thấy lô audit.');

    const rowsByBatch = await this.loadBatchRows([batch]);
    const rows = rowsByBatch.get(batchId) ?? [];

    const actorIds = [...new Set(rows.map((r) => r.actorId).filter((id): id is string => Boolean(id)))];
    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
            staffProfile: { select: { fullName: true } },
            adminProfile: { select: { adminUserName: true } },
          },
        })
      : [];
    const actorMap = new Map(actors.map((a) => [a.id, a]));
    const subjectMap = await this.resolver.resolveSubjectContextMap(rows);
    const logs = rows.map((row) =>
      this.presenter.presentAuditRow(row, row.actorId ? actorMap.get(row.actorId) : null, user, false, false, subjectMap.get(this.resolver.subjectKey(row)) ?? null),
    );
    const integrity = this.presenter.summarizeIntegrityFromPresented(logs);
    const contentSummary = (await this.presenter.buildBatchContentSummaries(rowsByBatch)).get(batchId) ?? [];

    const { artifactUri, ...safeBatch } = batch as typeof batch & { artifactUri?: string | null };
    return {
      ...safeBatch,
      artifactAvailable: Boolean(artifactUri && batch.artifactHash),
      contentSummary,
      integrity,
      logs,
    };
  }

  async loadBatchRows(batches: AuditBatchMembership[]): Promise<AuditBatchRows> {
    const byBatch: AuditBatchRows = new Map(batches.map((batch) => [batch.batchId, []]));
    if (!batches.length) return byBatch;

    const unfinalized = batches.filter(
      (batch) => UNFINALIZED_AUDIT_BATCH_STATUSES.has(batch.status)
        && batch.fromSeq != null
        && batch.toSeq != null,
    );
    const filters: Prisma.BlockchainLoggerWhereInput[] = [
      { batchId: { in: batches.map((batch) => batch.batchId) } },
      ...unfinalized.map((batch) => ({
        batchId: null,
        seq: { gte: batch.fromSeq!, lte: batch.toSeq! },
      })),
    ];
    const rows = await this.prisma.blockchainLogger.findMany({
      where: { OR: filters },
      orderBy: { seq: 'asc' },
    });

    for (const row of rows) {
      const rangeBatchId = row.batchId == null && row.seq != null
        ? unfinalized.find((batch) => row.seq! >= batch.fromSeq! && row.seq! <= batch.toSeq!)?.batchId
        : undefined;
      const batchId = row.batchId ?? rangeBatchId;
      if (batchId == null || !byBatch.has(batchId)) continue;
      byBatch.get(batchId)!.push(row);
    }

    return byBatch;
  }
}
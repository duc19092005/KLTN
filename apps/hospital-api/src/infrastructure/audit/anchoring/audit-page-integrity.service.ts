import { Injectable } from '@nestjs/common';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GENESIS_PREV_HASH,
  MERKLE_SHA256_STRING_V1,
  computeMerkleRootForAlgorithm,
  rootToBytes32,
  verifyAuditRowLight,
} from '..';
import { PageIntegrityResult, PageIntegrityTarget } from './audit-page-integrity.types';

type AuditRow = {
  seq: number | null; prevHash: string | null; entryHash: string | null; actorId: string | null;
  action: string; entity: string; entityId: string | null; dataHash: string | null;
  beforeHash: string | null; afterHash: string | null; diffHash: string | null;
  hashVersion: string | null; fieldsChanged: unknown; batchId: number | null; createdAt: Date;
};
type BatchVerification = { state: 'VERIFIED' | 'TAMPERED' | 'UNAVAILABLE' };

/** Verifies up to ten paginated entities, grouping all on-chain work by batch. */
@Injectable()
export class AuditPageIntegrityService {
  static readonly MAX_PAGE_SIZE = 10;
  private readonly checkpointCache = new Map<number, string>();

  constructor(private readonly prisma: PrismaService, private readonly blockchain: BlockchainService) {}

  async evaluate(targets: PageIntegrityTarget[]): Promise<Map<string, PageIntegrityResult>> {
    if (targets.length > AuditPageIntegrityService.MAX_PAGE_SIZE) {
      throw new Error(`AUDIT_PAGE_SIZE_EXCEEDED: maximum ${AuditPageIntegrityService.MAX_PAGE_SIZE} targets.`);
    }
    const results = new Map<string, PageIntegrityResult>();
    if (targets.length === 0) return results;
    const uniqueTargets = Array.from(new Map(targets.map((t) => [this.key(t.entity, t.entityId), t])).values());
    const rows = await this.prisma.blockchainLogger.findMany({
      where: { OR: uniqueTargets.map((t) => ({ entity: t.entity, entityId: t.entityId })) },
      orderBy: { seq: 'desc' }, distinct: ['entity', 'entityId'], select: this.rowSelect(),
    }) as AuditRow[];
    const latestByTarget = new Map(rows.map((row) => [this.key(row.entity, row.entityId ?? ''), row]));
    const batchIds = Array.from(new Set(rows.flatMap((row) => row.batchId == null ? [] : [row.batchId])));
    const batchStates = await this.verifyBatches(batchIds);
    const pending = rows.filter((row) => row.batchId == null && row.seq != null);
    const pendingStates = pending.length ? await this.verifyPending(pending) : null;

    for (const target of targets) {
      const latest = latestByTarget.get(this.key(target.entity, target.entityId));
      const base = {
        id: target.id, entity: target.entity, entityId: target.entityId,
        dbMatches: target.dbMatches ?? true, chainMatches: false, onChainHash: null,
        storedHash: target.storedHash ?? null, recomputedHash: target.recomputedHash ?? null,
        batchId: latest?.batchId ?? null, seq: latest?.seq ?? null,
      };
      if (!latest) { results.set(target.id, { ...base, status: 'UNANCHORED' }); continue; }
      if (latest.afterHash !== target.currentAfterHash || !verifyAuditRowLight(latest).ok) {
        results.set(target.id, { ...base, status: 'TAMPERED' }); continue;
      }
      if (latest.batchId == null) {
        const state = pendingStates?.get(latest.seq!);
        results.set(target.id, { ...base, status: state === 'UNAVAILABLE' ? 'VERIFICATION_UNAVAILABLE' : state === 'VERIFIED' ? 'PENDING_ANCHOR' : 'TAMPERED' });
        continue;
      }
      const state = batchStates.get(latest.batchId)?.state;
      if (!state || state === 'UNAVAILABLE') results.set(target.id, { ...base, status: 'VERIFICATION_UNAVAILABLE' });
      else if (state === 'VERIFIED') results.set(target.id, { ...base, status: 'VERIFIED', chainMatches: true, onChainHash: latest.afterHash });
      else results.set(target.id, { ...base, status: 'TAMPERED' });
    }
    return results;
  }

  private async verifyBatches(batchIds: number[]): Promise<Map<number, BatchVerification>> {
    const result = new Map<number, BatchVerification>();
    if (!batchIds.length) return result;
    const batches = await this.prisma.auditBatch.findMany({
      where: { batchId: { in: batchIds } },
      select: { batchId: true, merkleRoot: true, leafCount: true, fromSeq: true, toSeq: true, status: true, algorithmVersion: true },
    });
    const leaves = await this.prisma.blockchainLogger.findMany({ where: { batchId: { in: batchIds } }, orderBy: { seq: 'asc' }, select: this.rowSelect() }) as AuditRow[];
    const groups = new Map<number, AuditRow[]>();
    for (const leaf of leaves) { if (leaf.batchId != null) groups.set(leaf.batchId, [...(groups.get(leaf.batchId) ?? []), leaf]); }
    await Promise.all(batchIds.map(async (batchId) => {
      const batch = batches.find((item) => item.batchId === batchId);
      const group = groups.get(batchId) ?? [];
      if (!batch || batch.status !== 'ANCHORED' || batch.fromSeq == null || batch.toSeq == null || group.length !== batch.leafCount || group[0]?.seq !== batch.fromSeq || group[group.length - 1]?.seq !== batch.toSeq || !this.verifyRows(group)) {
        result.set(batchId, { state: 'TAMPERED' }); return;
      }
      const root = computeMerkleRootForAlgorithm(group.map((row) => row.entryHash!), batch.algorithmVersion ?? MERKLE_SHA256_STRING_V1);
      const rootBytes32 = rootToBytes32(root).toLowerCase();
      if (rootBytes32 !== rootToBytes32(batch.merkleRoot).toLowerCase()) { result.set(batchId, { state: 'TAMPERED' }); return; }
      const cached = this.checkpointCache.get(batchId);
      if (cached) { result.set(batchId, { state: cached === rootBytes32 ? 'VERIFIED' : 'TAMPERED' }); return; }
      try {
        const cp = await this.blockchain.getAuditCheckpoint(batchId);
        if (!cp) { result.set(batchId, { state: 'UNAVAILABLE' }); return; }
        const matches = cp.committed && cp.leafCount === batch.leafCount && cp.fromSeq === batch.fromSeq && cp.toSeq === batch.toSeq && rootToBytes32(cp.root).toLowerCase() === rootBytes32;
        if (!matches) { result.set(batchId, { state: 'TAMPERED' }); return; }
        this.checkpointCache.set(batchId, rootBytes32); result.set(batchId, { state: 'VERIFIED' });
      } catch { result.set(batchId, { state: 'UNAVAILABLE' }); }
    }));
    return result;
  }

  private async verifyPending(rows: AuditRow[]): Promise<Map<number, 'VERIFIED' | 'TAMPERED' | 'UNAVAILABLE'>> {
    const states = new Map<number, 'VERIFIED' | 'TAMPERED' | 'UNAVAILABLE'>();
    const seqs = rows.map((row) => row.seq!).sort((a, b) => a - b);
    const checkpoint = await this.prisma.auditBatch.findFirst({ where: { status: 'ANCHORED', toSeq: { lt: seqs[0] } }, orderBy: { toSeq: 'desc' }, select: { batchId: true, toSeq: true } });
    let start = 1; let previousHash = GENESIS_PREV_HASH;
    if (checkpoint?.toSeq != null) {
      const state = (await this.verifyBatches([checkpoint.batchId])).get(checkpoint.batchId)?.state;
      if (state !== 'VERIFIED') { seqs.forEach((seq) => states.set(seq, state === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'TAMPERED')); return states; }
      const tail = await this.prisma.blockchainLogger.findFirst({ where: { seq: checkpoint.toSeq }, select: { entryHash: true } });
      if (!tail?.entryHash) { seqs.forEach((seq) => states.set(seq, 'TAMPERED')); return states; }
      start = checkpoint.toSeq + 1; previousHash = tail.entryHash;
    }
    const suffix = await this.prisma.blockchainLogger.findMany({ where: { seq: { gte: start, lte: seqs[seqs.length - 1] } }, orderBy: { seq: 'asc' }, select: this.rowSelect() }) as AuditRow[];
    const targets = new Set(seqs); let expected = start; let broken = false;
    for (const row of suffix) {
      if (broken || row.seq !== expected || row.prevHash !== previousHash || !verifyAuditRowLight(row).ok) broken = true;
      if (targets.has(row.seq!)) states.set(row.seq!, broken ? 'TAMPERED' : 'VERIFIED');
      expected += 1; previousHash = row.entryHash ?? '';
    }
    seqs.forEach((seq) => { if (!states.has(seq)) states.set(seq, 'TAMPERED'); });
    return states;
  }

  private verifyRows(rows: AuditRow[]): boolean {
    return rows.every((row, index) => verifyAuditRowLight(row).ok && (index === 0 || (row.seq === rows[index - 1].seq! + 1 && row.prevHash === rows[index - 1].entryHash)));
  }
  private key(entity: string, entityId: string): string { return `${entity}\u0000${entityId}`; }
  private rowSelect() { return { seq: true, prevHash: true, entryHash: true, actorId: true, action: true, entity: true, entityId: true, dataHash: true, beforeHash: true, afterHash: true, diffHash: true, hashVersion: true, fieldsChanged: true, batchId: true, createdAt: true } as const; }
}

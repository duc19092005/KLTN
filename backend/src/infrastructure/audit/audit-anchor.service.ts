import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { computeMerkleRoot, buildMerkleProof, rootToBytes32, verifyMerkleProof } from './merkle.util';

/**
 * AuditAnchorService periodically seals a batch of not-yet-anchored audit logs, builds a Merkle
 * tree over their entryHashes, and commits ONLY the root on-chain (AuditAnchor.commitRoot).
 *
 * Cost model: one transaction per batch, independent of batch size. 10 logs or 10,000 logs both
 * cost a single ~80-120k-gas commit storing one 32-byte root, so per-log gas falls as volume
 * rises. Individual logs are never written on-chain.
 *
 * Trigger conditions (whichever comes first):
 *  - time:    every AUDIT_BATCH_INTERVAL_MS (default 5 min) -> bounds the "soft window"
 *  - size:    when >= AUDIT_BATCH_MAX_LEAVES unanchored logs accumulate (default 500)
 *  - explicit: anchorNow() for Tier-A events that must be sealed immediately
 *
 * A batch row is created PENDING, flipped to ANCHORED once the tx confirms (logs updated with
 * batchId/txHash), or marked FAILED if the commit fails (logs stay unanchored and retry next
 * cycle). Only anchoring metadata is mutated on log rows, which the append-only trigger permits.
 */
@Injectable()
export class AuditAnchorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuditAnchorService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  private readonly intervalMs = Number(process.env.AUDIT_BATCH_INTERVAL_MS ?? 5 * 60 * 1000);
  private readonly maxLeaves = Number(process.env.AUDIT_BATCH_MAX_LEAVES ?? 500);

  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchain: BlockchainService,
  ) {}

  onModuleInit() {
    // Guarantee the append-only trigger exists even when the schema was synced via
    // `prisma db push` (which does not apply raw-SQL migrations / triggers). Idempotent.
    this.ensureAppendOnlyTrigger().catch((err) =>
      this.logger.error('Failed to ensure append-only trigger', err),
    );

    if (process.env.AUDIT_BATCH_DISABLED === 'true') {
      this.logger.warn('Audit batch anchoring disabled via AUDIT_BATCH_DISABLED.');
      return;
    }
    // Stagger the first run so it doesn't fire during boot.
    this.timer = setInterval(() => {
      this.runCycle().catch((err) => this.logger.error('Audit batch cycle failed', err));
    }, this.intervalMs);
    this.logger.log(`Audit batch anchoring scheduled every ${this.intervalMs}ms (max ${this.maxLeaves} leaves/batch).`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * Create (or refresh) the BEFORE UPDATE/DELETE trigger that makes BlockchainLogger content
   * immutable: DELETE is always rejected, and UPDATE may only touch anchoring metadata
   * (onChainStatus/txHash/blockNumber/batchId). Runs on every boot; CREATE OR REPLACE +
   * DROP IF EXISTS make it safe to re-run. Mirrors the SQL in the dedicated migration so the
   * protection holds under both `prisma migrate` and `prisma db push` deployment paths.
   */
  private async ensureAppendOnlyTrigger(): Promise<void> {
    await this.prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION "blockchain_logger_append_only"()
      RETURNS TRIGGER AS $$
      BEGIN
        IF (TG_OP = 'DELETE') THEN
          RAISE EXCEPTION 'BlockchainLogger is append-only: DELETE is forbidden (seq=%).', OLD."seq";
        END IF;
        IF (TG_OP = 'UPDATE') THEN
          IF NEW."id"         IS DISTINCT FROM OLD."id"         OR
             NEW."actorId"    IS DISTINCT FROM OLD."actorId"    OR
             NEW."action"     IS DISTINCT FROM OLD."action"     OR
             NEW."entity"     IS DISTINCT FROM OLD."entity"     OR
             NEW."entityId"   IS DISTINCT FROM OLD."entityId"   OR
             NEW."metadata"   IS DISTINCT FROM OLD."metadata"   OR
             NEW."dataHash"   IS DISTINCT FROM OLD."dataHash"   OR
             NEW."dataSalt"   IS DISTINCT FROM OLD."dataSalt"   OR
             NEW."beforeJson" IS DISTINCT FROM OLD."beforeJson" OR
             NEW."afterJson"  IS DISTINCT FROM OLD."afterJson"  OR
             NEW."seq"        IS DISTINCT FROM OLD."seq"        OR
             NEW."prevHash"   IS DISTINCT FROM OLD."prevHash"   OR
             NEW."entryHash"  IS DISTINCT FROM OLD."entryHash"  OR
             NEW."createdAt"  IS DISTINCT FROM OLD."createdAt"
          THEN
            RAISE EXCEPTION 'BlockchainLogger is append-only: content columns are immutable (seq=%).', OLD."seq";
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await this.prisma.$executeRawUnsafe(
      `DROP TRIGGER IF EXISTS "trg_blockchain_logger_append_only" ON "BlockchainLogger";`,
    );
    await this.prisma.$executeRawUnsafe(`
      CREATE TRIGGER "trg_blockchain_logger_append_only"
        BEFORE UPDATE OR DELETE ON "BlockchainLogger"
        FOR EACH ROW EXECUTE FUNCTION "blockchain_logger_append_only"();
    `);
    this.logger.log('Append-only trigger on BlockchainLogger ensured.');
  }

  /** Force an immediate batch seal+commit (e.g. after a Tier-A clinical event). */
  async anchorNow(): Promise<{ committed: boolean; batchId?: number; leafCount?: number; reason?: string }> {
    return this.runCycle(true);
  }

  /**
   * Seal pending logs into a batch and commit the Merkle root on-chain. Guarded so only one
   * cycle runs at a time. When `force` is false the size threshold is informational only; the
   * timer always attempts to drain whatever is pending.
   */
  private async runCycle(force = false): Promise<{ committed: boolean; batchId?: number; leafCount?: number; reason?: string }> {
    if (this.running) return { committed: false, reason: 'cycle already running' };
    this.running = true;
    try {
      if (!this.blockchain.isAuditAnchorReady()) {
        return { committed: false, reason: 'AuditAnchor not configured' };
      }

      // Pull unanchored, chained logs in seq order, capped at maxLeaves per batch.
      const pending = await this.prisma.blockchainLogger.findMany({
        where: { batchId: null, seq: { not: null }, entryHash: { not: null } },
        orderBy: { seq: 'asc' },
        take: this.maxLeaves,
        select: { id: true, seq: true, entryHash: true },
      });

      if (pending.length === 0) return { committed: false, reason: 'nothing to anchor' };
      void force; // size gating is advisory; we always drain when invoked

      // Allocate a monotonic batchId, reconciling local state with the on-chain counter so we
      // never reuse an id the contract already has (it rejects duplicates).
      const localMax = await this.prisma.auditBatch.aggregate({ _max: { batchId: true } });
      const onChainLatest = (await this.blockchain.getLatestAuditBatchId()) ?? 0;
      const batchId = Math.max(localMax._max.batchId ?? 0, onChainLatest) + 1;

      const entryHashes = pending.map((p) => p.entryHash!);
      const merkleRoot = computeMerkleRoot(entryHashes);
      const fromSeq = pending[0].seq!;
      const toSeq = pending[pending.length - 1].seq!;

      // Record the batch as PENDING before the tx so a crash mid-commit is recoverable.
      await this.prisma.auditBatch.create({
        data: { batchId, merkleRoot, leafCount: pending.length, fromSeq, toSeq, status: 'PENDING' },
      });

      const res = await this.blockchain.commitAuditRoot(batchId, rootToBytes32(merkleRoot), pending.length);

      if (!res.success) {
        await this.prisma.auditBatch.update({
          where: { batchId },
          data: { status: 'FAILED', error: (res as any).error ?? 'commit failed' },
        });
        this.logger.error(`Batch ${batchId} commit failed: ${(res as any).error}`);
        return { committed: false, batchId, reason: (res as any).error };
      }

      // Confirmed: mark the batch ANCHORED and stamp every member log (metadata-only update,
      // permitted by the append-only trigger).
      const txHash = (res as any).txHash ?? null;
      const blockNumber = (res as any).blockNumber ?? null;
      await this.prisma.$transaction([
        this.prisma.auditBatch.update({
          where: { batchId },
          data: { status: 'ANCHORED', txHash, blockNumber, anchoredAt: new Date() },
        }),
        this.prisma.blockchainLogger.updateMany({
          where: { id: { in: pending.map((p) => p.id) } },
          data: { batchId, onChainStatus: 'ANCHORED', txHash, blockNumber },
        }),
      ]);

      this.logger.log(`Batch ${batchId} anchored: ${pending.length} logs (seq ${fromSeq}-${toSeq}), tx ${txHash}`);
      return { committed: true, batchId, leafCount: pending.length };
    } finally {
      this.running = false;
    }
  }

  /**
   * Build a Merkle inclusion proof for a single log within its committed batch, so an external
   * party can verify the log existed at anchor time without seeing the other logs.
   */
  async getInclusionProof(seq: number): Promise<{
    seq: number;
    batchId: number;
    entryHash: string;
    proof: string[];
    merkleRoot: string;
    onChainRoot: string | null;
    verified: boolean;
  } | null> {
    const log = await this.prisma.blockchainLogger.findFirst({
      where: { seq },
      select: { seq: true, batchId: true, entryHash: true },
    });
    if (!log || log.batchId == null || !log.entryHash) return null;

    const batchLogs = await this.prisma.blockchainLogger.findMany({
      where: { batchId: log.batchId, seq: { not: null }, entryHash: { not: null } },
      orderBy: { seq: 'asc' },
      select: { seq: true, entryHash: true },
    });
    const entryHashes = batchLogs.map((l) => l.entryHash!);
    const index = batchLogs.findIndex((l) => l.seq === seq);
    if (index < 0) return null;

    const proof = buildMerkleProof(entryHashes, index);
    const merkleRoot = computeMerkleRoot(entryHashes);
    const onChainRoot = await this.blockchain.getAuditRoot(log.batchId);
    const verified =
      verifyMerkleProof(log.entryHash, proof, merkleRoot) &&
      onChainRoot != null &&
      rootToBytes32(merkleRoot).toLowerCase() === onChainRoot.toLowerCase();

    return { seq, batchId: log.batchId, entryHash: log.entryHash, proof, merkleRoot, onChainRoot, verified };
  }
}

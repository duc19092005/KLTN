import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { GENESIS_PREV_HASH } from '../crypto/audit-hash.util';
import { AuditChainVerifier } from './audit-chain-verifier';

@Injectable()
export class AuditBatchPreparer {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchain: BlockchainService,
    private readonly verifier: AuditChainVerifier,
  ) {}

  async loadPendingLeaves(maxLeaves: number) {
    return this.prisma.blockchainLogger.findMany({
      where: { batchId: null, seq: { not: null }, entryHash: { not: null } },
      orderBy: { seq: 'asc' },
      take: maxLeaves,
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
        beforeHash: true,
        afterHash: true,
        diffHash: true,
        hashVersion: true,
        fieldsChanged: true,
        createdAt: true,
      },
    });
  }

  async validatePendingChain(pending: any[], isRecovery = false): Promise<void> {
    if (pending.length === 0) return;

    let expectedPrevHash = pending[0].prevHash ?? GENESIS_PREV_HASH;
    if (!isRecovery && pending[0].seq > 1) {
      const precedingLog = await this.prisma.blockchainLogger.findFirst({
        where: { seq: pending[0].seq - 1 },
        select: { entryHash: true },
      });
      if (!precedingLog) {
        throw new Error(`Đứt quãng số thứ tự: không tìm thấy bản ghi liền trước seq ${pending[0].seq}`);
      }
      expectedPrevHash = precedingLog.entryHash!;
    }

    let expectedSeq = pending[0].seq!;
    for (const log of pending) {
      if (log.seq !== expectedSeq) {
        throw new Error(`Đứt quãng số thứ tự: mong đợi ${expectedSeq}, nhận được ${log.seq}`);
      }
      if (log.prevHash !== expectedPrevHash) {
        throw new Error(`prevHash không khớp: mong đợi ${expectedPrevHash}, nhận được ${log.prevHash}`);
      }
      const recomputed = this.verifier.recomputeEntryHashForRow(log, log.prevHash ?? GENESIS_PREV_HASH);
      if (recomputed !== log.entryHash) {
        throw new Error(`entryHash không khớp: tính lại ${recomputed}, nhận được ${log.entryHash}`);
      }
      expectedPrevHash = log.entryHash!;
      expectedSeq += 1;
    }
  }

  async calculateNextBatchId(): Promise<number> {
    const localMax = await this.prisma.auditBatch.aggregate({ _max: { batchId: true } });
    const onChainLatest = (await this.blockchain.getLatestAuditBatchId(true)) ?? 0;
    return Math.max(localMax._max.batchId ?? 0, onChainLatest) + 1;
  }
}
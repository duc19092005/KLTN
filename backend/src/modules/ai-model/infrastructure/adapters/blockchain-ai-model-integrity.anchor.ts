import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { BlockchainService } from '../../../../infrastructure/blockchain/blockchain.service';
import { AuditLoggerService } from '../../../../infrastructure/audit/audit-logger.service';
import { hashToBytes32 } from '../../../../infrastructure/audit/audit-hash.util';
import {
  AiModelAnchorAction,
  AiModelIntegrityAnchorPort,
  IntegrityEvaluation,
} from '../../application/ports/ai-model-integrity-anchor.port';
import { buildAiModelSnapshot } from '../../domain/ai-model-snapshot';

/**
 * Tamper-evidence adapter for AI models. Logic copied verbatim from the former
 * AiModelService (anchorAiModelChange, evaluateIntegrity, getHistory): salted
 * hash, on-chain mirror via AIModelRegistry, hash256/dataSalt persistence, and
 * the BlockchainLogger audit entry. Only the salted hash goes on-chain.
 */
@Injectable()
export class BlockchainAiModelIntegrityAnchor implements AiModelIntegrityAnchorPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchain: BlockchainService,
    private readonly audit: AuditLoggerService,
  ) {}

  async anchorChange(model: any, action: AiModelAnchorAction, actorId?: string, before?: unknown): Promise<void> {
    const snapshot = buildAiModelSnapshot(model);
    let dataHash: string | null = null;
    let dataSalt: string | null = null;
    let onChainStatus = 'PENDING';
    let txHash: string | null = null;
    let blockNumber: number | null = null;

    try {
      if (action === 'DELETE') {
        const res = await this.blockchain.removeAiModelHash(model.id);
        onChainStatus = res.success ? 'ANCHORED' : 'UNANCHORED';
        txHash = (res as any).txHash ?? null;
        blockNumber = (res as any).blockNumber ?? null;
      } else {
        const { salt, hash } = this.audit.hashSnapshot(snapshot);
        dataHash = hash;
        dataSalt = salt;
        await this.prisma.aiModelRegistry.update({ where: { id: model.id }, data: { hash256: hash, dataSalt: salt } });
        const res = await this.blockchain.setAiModelHash(model.id, hashToBytes32(hash));
        onChainStatus = res.success ? 'ANCHORED' : 'UNANCHORED';
        txHash = (res as any).txHash ?? null;
        blockNumber = (res as any).blockNumber ?? null;
      }
    } catch {
      onChainStatus = 'UNANCHORED';
    }

    await this.audit.record({
      entity: 'AiModelRegistry',
      entityId: model.id,
      action,
      actorId,
      dataHash,
      dataSalt,
      before: before ?? null,
      after: action === 'DELETE' ? null : snapshot,
      onChainStatus,
      txHash,
      blockNumber,
    });
  }

  async evaluate(model: any): Promise<IntegrityEvaluation> {
    const snapshot = buildAiModelSnapshot(model);
    const recomputed = model.dataSalt ? this.audit.recompute(snapshot, model.dataSalt) : null;
    const dbHash = model.hash256 || null;
    const onChain = await this.blockchain.getAiModelHash(model.id);
    const onChainNormalized = onChain ? onChain.toLowerCase() : null;
    const recomputedBytes32 = recomputed ? hashToBytes32(recomputed).toLowerCase() : null;

    const dbMatches = recomputed !== null && recomputed === dbHash;
    const chainMatches = recomputedBytes32 !== null && recomputedBytes32 === onChainNormalized;

    let status: 'VERIFIED' | 'TAMPERED' | 'UNANCHORED';
    if (!onChainNormalized) status = 'UNANCHORED';
    else if (chainMatches) status = 'VERIFIED';
    else status = 'TAMPERED';

    return {
      id: model.id,
      modelName: model.modelName,
      modelVersion: model.modelVersion,
      status,
      dbMatches,
      chainMatches,
      recomputedHash: recomputed,
      storedHash: dbHash,
      onChainHash: onChain,
    };
  }

  history(id?: string) {
    return this.audit.history('AiModelRegistry', id);
  }
}

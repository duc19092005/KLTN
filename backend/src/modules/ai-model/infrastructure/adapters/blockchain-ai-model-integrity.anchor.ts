import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { AuditLoggerService } from '../../../../infrastructure/audit/audit-logger.service';
import { AuditAnchorService } from '../../../../infrastructure/audit/audit-anchor.service';
import {
  AiModelAnchorAction,
  AiModelIntegrityAnchorPort,
  IntegrityEvaluation,
} from '../../application/ports/ai-model-integrity-anchor.port';
import { buildAiModelSnapshot } from '../../domain/ai-model-snapshot';

/**
 * Tamper-evidence adapter for AI models. Uses the centralized AuditAnchor
 * (Merkle batch) for on-chain integrity verification instead of a dedicated
 * AIModelRegistry contract.
 */
@Injectable()
export class BlockchainAiModelIntegrityAnchor implements AiModelIntegrityAnchorPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLoggerService,
    private readonly auditAnchor: AuditAnchorService,
  ) {}

  async anchorChange(model: any, action: AiModelAnchorAction, actorId?: string, before?: unknown): Promise<void> {
    const snapshot = buildAiModelSnapshot(model);
    let dataHash: string | null = null;
    let dataSalt: string | null = null;

    try {
      if (action !== 'DELETE') {
        const { salt, hash } = this.audit.hashSnapshot(snapshot);
        dataHash = hash;
        dataSalt = salt;
        await this.prisma.aiModelRegistry.update({ where: { id: model.id }, data: { hash256: hash, dataSalt: salt } });
      }
    } catch {
      // Hash computation failed; log entry will still be created below with null hashes.
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
      onChainStatus: 'PENDING',
    });
  }

  async evaluate(model: any): Promise<IntegrityEvaluation> {
    const snapshot = buildAiModelSnapshot(model);
    const recomputed = model.dataSalt ? this.audit.recompute(snapshot, model.dataSalt) : null;
    const dbHash = model.hash256 || null;
    const dbMatches = recomputed !== null && recomputed === dbHash;

    const latestLog = await this.prisma.blockchainLogger.findFirst({
      where: { entity: 'AiModelRegistry', entityId: model.id, batchId: { not: null } },
      orderBy: { seq: 'desc' },
      select: { seq: true, dataHash: true, batchId: true },
    });

    let chainMatches = false;
    if (latestLog?.seq) {
      try {
        const proof = await this.auditAnchor.getInclusionProof(latestLog.seq);
        if (proof && proof.verified) {
          chainMatches = latestLog.dataHash === recomputed;
        }
      } catch { /* proof verification failed */ }
    }

    // Latest log entry overall (regardless of anchor status). Used to detect the window
    // between a write and the next Merkle batch so we don't mislabel a freshly-edited
    // record as TAMPERED.
    const latestAny = await this.prisma.blockchainLogger.findFirst({
      where: { entity: 'AiModelRegistry', entityId: model.id },
      orderBy: { seq: 'desc' },
      select: { seq: true, dataHash: true, batchId: true },
    });

    let status: 'VERIFIED' | 'TAMPERED' | 'UNANCHORED' | 'PENDING_ANCHOR';
    if (!latestAny) {
      status = 'UNANCHORED';
    } else if (!latestLog || (latestAny.seq !== latestLog.seq && latestAny.dataHash === recomputed)) {
      // A newer (or first-ever) log exists that isn't anchored yet, and its hash matches the
      // current DB row → the write is just waiting for the next Merkle batch. Not tampering.
      status = dbMatches ? 'PENDING_ANCHOR' : 'TAMPERED';
    } else if (dbMatches && chainMatches) {
      status = 'VERIFIED';
    } else {
      status = 'TAMPERED';
    }

    if (status === 'TAMPERED') {
      await this.auditAnchor.sendTelegramAlert(
        'Phát hiện giả mạo mô hình AI',
        `Mô hình: ${model.modelName} (Phiên bản: ${model.modelVersion}, ID: ${model.id})\n` +
        `• Hash CSDL: ${dbHash}\n` +
        `• Hash On-Chain: ${latestLog?.dataHash}\n` +
        `• So khớp DB: ${dbMatches ? 'Khớp' : 'LỆCH'}\n` +
        `• So khớp Chain: ${chainMatches ? 'Khớp' : 'LỆCH'}`
      );
    }

    return {
      id: model.id,
      modelName: model.modelName,
      modelVersion: model.modelVersion,
      status,
      dbMatches,
      chainMatches,
      recomputedHash: recomputed,
      storedHash: dbHash,
      onChainHash: latestLog?.dataHash ?? null,
    };
  }

  history(id?: string) {
    return this.audit.history('AiModelRegistry', id);
  }
}

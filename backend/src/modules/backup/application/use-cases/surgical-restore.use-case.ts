import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { AuditAnchorService } from '../../../../infrastructure/audit/audit-anchor.service';
import { AuditLoggerService } from '../../../../infrastructure/audit/audit-logger.service';
import { ENTITY_RESTORE_REGISTRY, isRestorable } from '../../domain/entity-restore-registry';

export interface SurgicalRestoreItem {
  entity: string;
  entityId: string;
}

export interface SurgicalRestoreResult {
  restored: Array<{ entity: string; entityId: string; restoredFromSeq: number }>;
  skipped: Array<{ entity: string; entityId: string; reason: string }>;
  restoredAt: string;
}

/**
 * Surgical recovery: reapply the last on-chain-anchored, proof-verified snapshot to ONLY the
 * specified tampered records. Unlike a full rollback, every other row — including legitimate
 * changes made after the tamper — is left untouched, so no valid data is lost.
 *
 * Safety:
 *  - Each target's anchored snapshot is re-verified via Merkle inclusion proof before it is trusted.
 *  - All writes run inside a single transaction so a partial failure rolls back cleanly.
 *  - The restore itself is recorded in the audit trail (action='RESTORE'), keeping the chain honest
 *    about who reverted what and when.
 *
 * This is the answer to "rollback về 01:29 thì mất dữ liệu 02:00–10:00?": we don't roll back time,
 * we fix only the poisoned rows using their trusted on-chain snapshot.
 */
@Injectable()
export class SurgicalRestoreUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditAnchor: AuditAnchorService,
    private readonly audit: AuditLoggerService,
  ) {}

  async execute(items: SurgicalRestoreItem[], actorId?: string): Promise<SurgicalRestoreResult> {
    if (!items || items.length === 0) {
      throw new BadRequestException('Danh sách bản ghi cần khôi phục đang trống.');
    }

    const restored: SurgicalRestoreResult['restored'] = [];
    const skipped: SurgicalRestoreResult['skipped'] = [];

    // Resolve each target to a trusted anchored snapshot first (read-only, no mutation yet).
    const plans: Array<{ entity: string; entityId: string; prismaModel: string; data: Record<string, any>; seq: number }> = [];

    for (const item of items) {
      if (!isRestorable(item.entity)) {
        skipped.push({ entity: item.entity, entityId: item.entityId, reason: 'Entity không hỗ trợ khôi phục phẫu thuật.' });
        continue;
      }
      const spec = ENTITY_RESTORE_REGISTRY[item.entity];

      const log = await this.prisma.blockchainLogger.findFirst({
        where: { entity: item.entity, entityId: item.entityId, batchId: { not: null }, afterJson: { not: undefined } },
        orderBy: { seq: 'desc' },
        select: { seq: true, afterJson: true },
      });

      if (!log || log.seq == null || !log.afterJson) {
        skipped.push({ entity: item.entity, entityId: item.entityId, reason: 'Không tìm thấy snapshot đã neo on-chain.' });
        continue;
      }

      const proof = await this.auditAnchor.getInclusionProof(log.seq);
      if (!proof || !proof.verified) {
        skipped.push({ entity: item.entity, entityId: item.entityId, reason: 'Không xác minh được bằng chứng Merkle on-chain.' });
        continue;
      }

      plans.push({
        entity: item.entity,
        entityId: item.entityId,
        prismaModel: spec.prismaModel,
        data: spec.toUpdateData(log.afterJson as Record<string, any>),
        seq: log.seq,
      });
    }

    if (plans.length === 0) {
      return { restored, skipped, restoredAt: new Date().toISOString() };
    }

    // Apply all restores atomically.
    await this.prisma.$transaction(async (tx) => {
      for (const plan of plans) {
        await (tx as any)[plan.prismaModel].update({ where: { id: plan.entityId }, data: plan.data });
      }
    });

    // Record each restore in the audit trail (outside the tx so the chain writer stays serialized).
    for (const plan of plans) {
      try {
        await this.audit.record({
          entity: plan.entity,
          entityId: plan.entityId,
          action: 'RESTORE',
          actorId: actorId ?? null,
          after: plan.data,
          metadata: { restoredFromSeq: plan.seq } as any,
          onChainStatus: 'PENDING',
        });
      } catch {
        /* audit of the restore is best-effort; the next scan still reflects the corrected state */
      }
      restored.push({ entity: plan.entity, entityId: plan.entityId, restoredFromSeq: plan.seq });
    }

    // Seal the restore actions on-chain promptly (Tier-A: data-correcting operation).
    try {
      await this.auditAnchor.anchorNow();
    } catch {
      /* will be sealed by the next batch cycle */
    }

    return { restored, skipped, restoredAt: new Date().toISOString() };
  }
}

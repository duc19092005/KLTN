import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { AuditAnchorService } from '../../../../infrastructure/audit/audit-anchor.service';
import { canonicalize } from '../../../../infrastructure/audit/audit-hash.util';
import { ENTITY_RESTORE_REGISTRY } from '../../domain/entity-restore-registry';

export interface TamperedRecord {
  entity: string;
  entityId: string;
  anchoredSeq: number;
  anchoredAtBatch: number;
  /** Business fields that differ between the on-chain-anchored snapshot and the live DB row. */
  driftedFields: string[];
}

export interface IntegrityScanResult {
  scannedEntities: string[];
  totalChecked: number;
  tampered: TamperedRecord[];
  cleanCount: number;
  scannedAt: string;
}

/**
 * Surgical tamper detection. For every restorable entity, take the latest BlockchainLogger entry
 * that is genuinely anchored on-chain (Merkle inclusion proof verifies against the committed root)
 * and diff its trusted `afterJson` snapshot against the LIVE DB row. Any field that drifted means
 * the live row was altered away from its last sealed-on-chain state — a tamper signal that does NOT
 * depend on the secret pepper (the anchored snapshot is the ground truth, the chain proves it).
 *
 * This is what makes surgical recovery possible: we learn exactly WHICH records and WHICH fields
 * are bad, so we can fix only those instead of rolling the whole database back.
 */
@Injectable()
export class ScanIntegrityUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditAnchor: AuditAnchorService,
  ) {}

  async execute(): Promise<IntegrityScanResult> {
    const tampered: TamperedRecord[] = [];
    let totalChecked = 0;

    const entities = Object.keys(ENTITY_RESTORE_REGISTRY);
    for (const entity of entities) {
      const spec = ENTITY_RESTORE_REGISTRY[entity];

      // Distinct entityIds that have at least one anchored log for this entity.
      const anchoredLogs = await this.prisma.blockchainLogger.findMany({
        where: { entity, batchId: { not: null }, entityId: { not: null } },
        orderBy: { seq: 'desc' },
        select: { seq: true, entityId: true, afterJson: true, batchId: true },
      });

      // Keep only the latest anchored entry per entityId.
      const latestByEntity = new Map<string, (typeof anchoredLogs)[number]>();
      for (const log of anchoredLogs) {
        if (log.entityId && !latestByEntity.has(log.entityId)) latestByEntity.set(log.entityId, log);
      }

      for (const [entityId, log] of latestByEntity) {
        if (!log.afterJson || log.seq == null || log.batchId == null) continue;
        totalChecked += 1;

        // Confirm the anchored snapshot is genuinely on-chain before trusting it.
        const proof = await this.auditAnchor.getInclusionProof(log.seq);
        if (!proof || !proof.verified) continue;

        const liveRow: any = await (this.prisma as any)[spec.prismaModel].findUnique({ where: { id: entityId } });
        if (!liveRow) continue; // deleted rows are handled by full restore, not surgical field-fix

        const anchoredData = spec.toUpdateData(log.afterJson as Record<string, any>);
        const liveData = spec.toUpdateData(liveRow);

        const driftedFields = Object.keys(anchoredData).filter(
          (k) => canonicalize(anchoredData[k]) !== canonicalize(liveData[k]),
        );

        if (driftedFields.length > 0) {
          tampered.push({ entity, entityId, anchoredSeq: log.seq, anchoredAtBatch: log.batchId, driftedFields });
        }
      }
    }

    if (tampered.length > 0) {
      await this.auditAnchor.sendTelegramAlert(
        'Phát hiện sai lệch toàn vẹn dữ liệu (Integrity Scan)',
        `Số bản ghi bị sửa lệch khỏi trạng thái đã neo on-chain: ${tampered.length}\n` +
          tampered
            .slice(0, 10)
            .map((t) => `• ${t.entity}#${t.entityId} (trường: ${t.driftedFields.join(', ')})`)
            .join('\n'),
      );
    }

    return {
      scannedEntities: entities,
      totalChecked,
      tampered,
      cleanCount: totalChecked - tampered.length,
      scannedAt: new Date().toISOString(),
    };
  }
}

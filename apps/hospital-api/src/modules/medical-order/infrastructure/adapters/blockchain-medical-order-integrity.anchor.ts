import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditLoggerService, AuditPageIntegrityService, computeAfterHashV2 } from '../../../../infrastructure/audit';
import { PageIntegrityResult } from '../../../../infrastructure/audit/anchoring/audit-page-integrity.types';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { MedicalOrderIntegrityAnchorPort, ClinicalRecordAction } from '../../application/ports/medical-integrity-anchor.port';
import { buildMedicalOrderSnapshot } from '../../domain/medical-order-snapshot';

@Injectable()
export class BlockchainMedicalOrderIntegrityAnchor implements MedicalOrderIntegrityAnchorPort {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditLoggerService, private readonly pageIntegrity: AuditPageIntegrityService) {}

  async anchorChange(order: any, action: ClinicalRecordAction, actorId?: string | null, before?: Record<string, unknown> | null, tx?: Prisma.TransactionClient): Promise<void> {
    const snapshot = buildMedicalOrderSnapshot(order);
    const { hash, salt } = this.audit.hashSnapshot(snapshot);
    const client = tx ?? this.prisma;
    await client.medicalOrder.update({ where: { id: order.id }, data: { hash256: hash, dataSalt: salt } });
    await this.audit.recordV2({ entity: 'MedicalOrder', entityId: order.id, action, actorId: actorId ?? null, before: before ?? null, after: snapshot, metadata: { schema: 'KLTN_MEDICAL_ORDER_INTEGRITY_V3' }, onChainStatus: 'PENDING' }, tx);
  }

  async evaluateMany(orders: any[]): Promise<Map<string, PageIntegrityResult>> {
    return this.pageIntegrity.evaluate(orders.map((order) => {
      const snapshot = buildMedicalOrderSnapshot(order);
      const recomputedHash = order.dataSalt ? this.audit.recompute(snapshot, order.dataSalt) : null;
      const storedHash = order.hash256 ?? null;
      return { id: order.id, entity: 'MedicalOrder', entityId: order.id, currentAfterHash: computeAfterHashV2('MedicalOrder', order.id, snapshot), storedHash, recomputedHash, dbMatches: recomputedHash !== null && recomputedHash === storedHash };
    }));
  }
}

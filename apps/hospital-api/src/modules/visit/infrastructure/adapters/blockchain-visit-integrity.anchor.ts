import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AuditLoggerService,
  AuditPageIntegrityService,
  computeAfterHashV2,
} from '../../../../infrastructure/audit';
import { PageIntegrityResult } from '../../../../infrastructure/audit/anchoring/audit-page-integrity.types';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import {
  VisitAnchorAction,
  VisitIntegrityAnchorPort,
} from '../../application/ports/visit-integrity-anchor.port';
import { buildVisitSnapshot } from '../../domain/visit-snapshot';

@Injectable()
export class BlockchainVisitIntegrityAnchor implements VisitIntegrityAnchorPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLoggerService,
    private readonly pageIntegrity: AuditPageIntegrityService,
  ) {}

  async anchorChange(
    visit: any,
    action: VisitAnchorAction,
    actorId?: string | null,
    before?: Record<string, unknown> | null,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const snapshot = buildVisitSnapshot(visit);
    const { hash, salt } = this.audit.hashSnapshot(snapshot);
    const client = tx ?? this.prisma;
    await client.visit.update({ where: { id: visit.id }, data: { hash256: hash, dataSalt: salt } });
    await this.audit.recordV2({
      entity: 'Visit',
      entityId: visit.id,
      action,
      actorId: actorId ?? null,
      before: before ?? null,
      after: snapshot,
      metadata: { schema: 'KLTN_VISIT_INTEGRITY_V4' },
      onChainStatus: 'PENDING',
    }, tx);
  }

  async evaluateMany(visits: any[]): Promise<Map<string, PageIntegrityResult>> {
    const targets = visits.map((visit) => {
      const snapshot = buildVisitSnapshot(visit);
      const recomputedHash = visit.dataSalt ? this.audit.recompute(snapshot, visit.dataSalt) : null;
      const storedHash = visit.hash256 ?? null;
      return {
        id: visit.id,
        entity: 'Visit',
        entityId: visit.id,
        currentAfterHash: computeAfterHashV2('Visit', visit.id, snapshot),
        storedHash,
        recomputedHash,
        dbMatches: recomputedHash !== null && recomputedHash === storedHash,
      };
    });
    return this.pageIntegrity.evaluate(targets);
  }
}

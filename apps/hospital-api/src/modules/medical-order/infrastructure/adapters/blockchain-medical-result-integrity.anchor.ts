import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditLoggerService, AuditPageIntegrityService, computeAfterHashV2 } from '../../../../infrastructure/audit';
import { PageIntegrityResult } from '../../../../infrastructure/audit/anchoring/audit-page-integrity.types';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { MedicalResultIntegrityAnchorPort, ClinicalRecordAction } from '../../application/ports/medical-integrity-anchor.port';
import { buildMedicalResultSnapshot } from '../../domain/medical-result-snapshot';

@Injectable()
export class BlockchainMedicalResultIntegrityAnchor implements MedicalResultIntegrityAnchorPort {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditLoggerService, private readonly pageIntegrity: AuditPageIntegrityService) {}

  async anchorChange(result: any, action: ClinicalRecordAction, actorId?: string | null, before?: Record<string, unknown> | null, tx?: Prisma.TransactionClient): Promise<void> {
    const resultId = result.id ?? result.resultId;
    const snapshot = buildMedicalResultSnapshot(result);
    const { hash, salt } = this.audit.hashSnapshot(snapshot);
    const client = tx ?? this.prisma;
    await client.medicalResult.update({ where: { id: resultId }, data: { hash256: hash, dataSalt: salt } });
    await this.audit.recordV2({ entity: 'MedicalResult', entityId: resultId, action, actorId: actorId ?? null, before: before ?? null, after: snapshot, metadata: { schema: 'KLTN_MEDICAL_RESULT_INTEGRITY_V3' }, onChainStatus: 'PENDING' }, tx);
  }

  async evaluateMany(results: any[]): Promise<Map<string, PageIntegrityResult>> {
    return this.pageIntegrity.evaluate(results.map((result) => {
      const snapshot = buildMedicalResultSnapshot(result);
      const recomputedHash = result.dataSalt ? this.audit.recompute(snapshot, result.dataSalt) : null;
      const storedHash = result.hash256 ?? null;
      return { id: result.id, entity: 'MedicalResult', entityId: result.id, currentAfterHash: computeAfterHashV2('MedicalResult', result.id, snapshot), storedHash, recomputedHash, dbMatches: recomputedHash !== null && recomputedHash === storedHash };
    }));
  }
}

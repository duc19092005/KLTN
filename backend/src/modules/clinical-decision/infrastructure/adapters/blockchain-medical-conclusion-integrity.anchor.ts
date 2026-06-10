import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { AuditLoggerService } from '../../../../infrastructure/audit/audit-logger.service';
import { AuditAnchorService } from '../../../../infrastructure/audit/audit-anchor.service';
import {
  MedicalConclusionAnchorAction,
  MedicalConclusionIntegrityAnchorPort,
} from '../../application/ports/medical-conclusion-integrity-anchor.port';
import { buildMedicalConclusionSnapshot } from '../../domain/medical-conclusion-snapshot';

/**
 * Adapter implementing tamper-evidence for medical conclusions.
 * Calculates salted hashes of conclusions, updates the DB columns (hash256/dataSalt),
 * and creates corresponding BlockchainLogger audit log records.
 * Initiates immediate anchoring on-chain (Tier-A event).
 */
@Injectable()
export class BlockchainMedicalConclusionIntegrityAnchor implements MedicalConclusionIntegrityAnchorPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLoggerService,
    private readonly auditAnchor: AuditAnchorService,
  ) {}

  async anchorChange(
    conclusion: any,
    action: MedicalConclusionAnchorAction,
    actorId?: string,
    before?: unknown,
    tx?: import('@prisma/client').Prisma.TransactionClient,
  ): Promise<void> {
    const writeAudit = async (client: import('@prisma/client').Prisma.TransactionClient) => {
      const snapshot = buildMedicalConclusionSnapshot(conclusion);
      if (!snapshot) {
        throw new Error('Cannot build MedicalConclusion audit snapshot.');
      }

      const { salt, hash } = this.audit.hashSnapshot(snapshot);

      await client.medicalConclusion.update({
        where: { id: conclusion.id },
        data: { hash256: hash, dataSalt: salt },
      });

      await this.audit.record(
        {
          entity: 'MedicalConclusion',
          entityId: conclusion.id,
          action,
          actorId,
          dataHash: hash,
          dataSalt: salt,
          before: before ?? null,
          after: snapshot,
          onChainStatus: 'PENDING',
        },
        client,
      );
    };

    if (tx) {
      await writeAudit(tx);
      return;
    }

    await this.prisma.$transaction(async (client) => {
      await writeAudit(client);
    });

    try {
      await this.auditAnchor.anchorNow();
    } catch (err) {
      console.error('[MedicalConclusion] Immediate anchoring failed, will retry in batch cycle:', err);
    }
  }

  async triggerImmediateAnchor(): Promise<void> {
    try {
      await this.auditAnchor.anchorNow();
    } catch (err) {
      console.error('[MedicalConclusion] Immediate anchoring failed, will retry in batch cycle:', err);
    }
  }
}

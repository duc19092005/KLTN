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
  ): Promise<void> {
    const snapshot = buildMedicalConclusionSnapshot(conclusion);
    if (!snapshot) return;

    let dataHash: string | null = null;
    let dataSalt: string | null = null;
    let onChainStatus = 'PENDING';

    try {
      // 1. Generate salt and hash the snapshot
      const { salt, hash } = this.audit.hashSnapshot(snapshot);
      dataHash = hash;
      dataSalt = salt;

      // 2. Update MedicalConclusion database row with integrity hash data
      await this.prisma.medicalConclusion.update({
        where: { id: conclusion.id },
        data: { hash256: hash, dataSalt: salt },
      });
    } catch (err) {
      console.error('Error calculating and saving medical conclusion hash:', err);
      onChainStatus = 'UNANCHORED';
    }

    // 3. Record audit entry in BlockchainLogger.
    try {
      await this.audit.record({
        entity: 'MedicalConclusion',
        entityId: conclusion.id,
        action,
        actorId,
        dataHash,
        dataSalt,
        before: before ?? null,
        after: snapshot,
        onChainStatus,
      });
    } catch (err) {
      console.error('Error writing audit trail for medical conclusion:', err);
    }

    // 4. Trigger immediate Merkle root commit (Tier-A event) to protect the conclusion instantly
    if (onChainStatus === 'PENDING') {
      try {
        await this.auditAnchor.anchorNow();
      } catch (err) {
        console.error('[MedicalConclusion] Immediate anchoring failed, will retry in batch cycle:', err);
      }
    }
  }
}

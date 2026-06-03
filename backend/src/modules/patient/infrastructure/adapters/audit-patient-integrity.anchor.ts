import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { AuditLoggerService } from '../../../../infrastructure/audit/audit-logger.service';
import { AuditAnchorService } from '../../../../infrastructure/audit/audit-anchor.service';
import {
  PatientIntegrityAnchorPort,
  PatientIntegrityEvaluation,
} from '../../application/ports/patient-integrity-anchor.port';
import { buildPatientSnapshot } from '../../domain/patient-snapshot';

/**
 * Tamper-evidence adapter for Patient records. Uses the centralized AuditAnchor
 * (Merkle batch) for on-chain integrity verification. No dedicated smart contract
 * is needed — the hash is stored locally (hash256/dataSalt) and recorded in
 * BlockchainLogger, then batch-anchored via AuditAnchor.sol.
 */
@Injectable()
export class AuditPatientIntegrityAnchor implements PatientIntegrityAnchorPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLoggerService,
    private readonly auditAnchor: AuditAnchorService,
  ) {}

  async anchorChange(patient: any, action: string, actorId?: string, before?: unknown): Promise<void> {
    const snapshot = buildPatientSnapshot(patient);
    let dataHash: string | null = null;
    let dataSalt: string | null = null;

    try {
      if (action !== 'DELETE') {
        const { salt, hash } = this.audit.hashSnapshot(snapshot);
        dataHash = hash;
        dataSalt = salt;
        await this.prisma.patient.update({
          where: { id: patient.id },
          data: { hash256: hash, dataSalt: salt },
        });
      }
    } catch (err) {
      console.error('Error computing patient hash:', err);
    }

    await this.audit.record({
      entity: 'Patient',
      entityId: patient.id,
      action,
      actorId,
      dataHash,
      dataSalt,
      before: before ?? null,
      after: action === 'DELETE' ? null : snapshot,
      onChainStatus: 'PENDING',
    });
  }

  async evaluate(patient: any): Promise<PatientIntegrityEvaluation> {
    const snapshot = buildPatientSnapshot(patient);
    const recomputed = patient.dataSalt ? this.audit.recompute(snapshot, patient.dataSalt) : null;
    const dbHash = patient.hash256 || null;
    const dbMatches = recomputed !== null && recomputed === dbHash;

    const latestLog = await this.prisma.blockchainLogger.findFirst({
      where: { entity: 'Patient', entityId: patient.id, batchId: { not: null } },
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

    let status: 'VERIFIED' | 'TAMPERED' | 'UNANCHORED';
    if (!latestLog || !latestLog.batchId) status = 'UNANCHORED';
    else if (dbMatches && chainMatches) status = 'VERIFIED';
    else status = 'TAMPERED';

    return {
      id: patient.id,
      patientCode: patient.patientCode,
      fullName: patient.fullName,
      status,
      dbMatches,
      chainMatches,
      recomputedHash: recomputed,
      storedHash: dbHash,
    };
  }

  history(id?: string) {
    return this.audit.history('Patient', id);
  }
}

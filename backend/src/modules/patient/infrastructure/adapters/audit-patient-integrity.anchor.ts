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
 *
 * ANCHORING POLICY — INTENTIONALLY BATCH (NOT immediate):
 *   Patient changes deliberately do NOT call auditAnchor.anchorNow(); they wait for the
 *   normal ~5 min batch cycle. Rationale: the patient snapshot holds only demographic /
 *   identity data (name, citizenId, phone, insurance...), none of which is life-critical,
 *   and the hash-chain in the DB already makes any tamper evidence-bearing within the window.
 *   Patient records are also created frequently at the reception desk, so per-record on-chain
 *   commits would waste gas with no safety gain.
 *
 *   SWITCH TO IMMEDIATE (add `await this.auditAnchor.anchorNow()` after record()) ONLY IF the
 *   snapshot is ever extended with life-critical clinical fields (e.g. bloodType, allergies):
 *   silently editing those within the batch window could be fatal on the next transfusion /
 *   prescription, which justifies sealing the proof on-chain at the exact moment of change.
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

    try {
      if (action !== 'DELETE') {
        const { salt, hash } = this.audit.hashSnapshot(snapshot);
        await this.prisma.patient.update({
          where: { id: patient.id },
          data: { hash256: hash, dataSalt: salt },
        });
      }
    } catch (err) {
      console.error('Error computing patient hash:', err);
    }

    await this.audit.recordV2({
      entity: 'Patient',
      entityId: patient.id,
      action,
      actorId,
      before: this.toAuditSnapshot(before),
      after: action === 'DELETE' ? null : snapshot,
      onChainStatus: 'PENDING',
    });
  }

  private toAuditSnapshot(value: unknown): Record<string, unknown> | null {
    if (value == null) return null;
    if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
    return { value };
  }

  async evaluate(patient: any, skipChainCheck = false): Promise<PatientIntegrityEvaluation> {
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
      if (skipChainCheck) {
        chainMatches = latestLog.dataHash === recomputed;
      } else {
        try {
          const proof = await this.auditAnchor.getInclusionProof(latestLog.seq);
          if (proof && proof.verified) {
            chainMatches = latestLog.dataHash === recomputed;
          }
        } catch { /* proof verification failed */ }
      }
    }

    let status: 'VERIFIED' | 'TAMPERED' | 'UNANCHORED';
    if (!latestLog || !latestLog.batchId) status = 'UNANCHORED';
    else if (dbMatches && chainMatches) status = 'VERIFIED';
    else status = 'TAMPERED';

    if (status === 'TAMPERED') {
      await this.auditAnchor.sendTelegramAlert(
        'Phát hiện giả mạo thông tin bệnh nhân',
        `Bệnh nhân: ${patient.fullName} (Mã: ${patient.patientCode}, ID: ${patient.id})\n` +
        `• Hash CSDL: ${dbHash}\n` +
        `• So khớp DB: ${dbMatches ? 'Khớp' : 'LỆCH'}`
      );
    }

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

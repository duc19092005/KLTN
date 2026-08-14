import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { AuditLoggerService } from '../../../../infrastructure/audit/audit-logger.service';
import { AuditAnchorService } from '../../../../infrastructure/audit/audit-anchor.service';
import { computeAfterHashV2 } from '../../../../infrastructure/audit/audit-hash.util';
import {
  PatientIntegrityAnchorPort,
  PatientIntegrityEvaluation,
} from '../../application/ports/patient-integrity-anchor.port';
import { buildPatientSnapshot } from '../../domain/patient-snapshot';
import { Prisma } from '@prisma/client';

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

  async anchorChange(patient: any, action: string, actorId?: string, before?: unknown, tx?: Prisma.TransactionClient): Promise<void> {
    const snapshot = buildPatientSnapshot(patient);

    if (action !== 'DELETE') {
      const { salt, hash } = this.audit.hashSnapshot(snapshot);
      const client = tx ?? this.prisma;
      await client.patient.update({
        where: { id: patient.id },
        data: { hash256: hash, dataSalt: salt },
      });
    }

    await this.audit.recordV2({
      entity: 'Patient',
      entityId: patient.id,
      action,
      actorId,
      before: this.toAuditSnapshot(before),
      after: action === 'DELETE' ? null : snapshot,
      onChainStatus: 'PENDING',
    }, tx);
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
    const currentAfterHash = computeAfterHashV2('Patient', patient.id, snapshot);

    const latestAnchored = await this.prisma.blockchainLogger.findFirst({
      where: { entity: 'Patient', entityId: patient.id, batchId: { not: null } },
      orderBy: { seq: 'desc' },
      select: { seq: true, afterHash: true, batchId: true },
    });

    const latestAny = await this.prisma.blockchainLogger.findFirst({
      where: { entity: 'Patient', entityId: patient.id },
      orderBy: { seq: 'desc' },
      select: { seq: true, afterHash: true, batchId: true },
    });

    let chainMatches = false;
    if (latestAnchored?.seq) {
      if (skipChainCheck) {
        chainMatches = latestAnchored.afterHash === currentAfterHash;
      } else {
        try {
          const proof = await this.auditAnchor.getInclusionProof(latestAnchored.seq);
          if (proof?.verified) {
            chainMatches = latestAnchored.afterHash === currentAfterHash;
          }
        } catch { /* proof verification failed */ }
      }
    }

    let status: 'VERIFIED' | 'TAMPERED' | 'UNANCHORED';
    if (!latestAny) {
      status = 'UNANCHORED';
    } else if (!latestAnchored || (latestAny.seq !== latestAnchored.seq && latestAny.afterHash === currentAfterHash)) {
      status = dbMatches ? 'UNANCHORED' : 'TAMPERED';
    } else if (dbMatches && chainMatches) {
      status = 'VERIFIED';
    } else {
      status = 'TAMPERED';
    }

    if (status === 'TAMPERED') {
      await this.auditAnchor.sendTelegramAlert(
        'Phát hiện giả mạo thông tin bệnh nhân',
        `Bệnh nhân: ${patient.fullName} (Mã: ${patient.patientCode}, ID: ${patient.id})\n` +
        `• Hash CSDL: ${dbHash}\n` +
        `• Hash Audit đã neo: ${latestAnchored?.afterHash ?? 'Không có'}\n` +
        `• So khớp DB: ${dbMatches ? 'Khớp' : 'LỆCH'}\n` +
        `• So khớp Chain: ${chainMatches ? 'Khớp' : 'LỆCH'}`
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

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { AuditLoggerService } from '../../../../infrastructure/audit/audit-logger.service';
import { AuditAnchorService } from '../../../../infrastructure/audit/audit-anchor.service';
import {
  DoctorAnchorAction,
  DoctorIntegrityAnchorPort,
  DoctorIntegrityEvaluation,
} from '../../application/ports/doctor-integrity-anchor.port';
import { buildUnifiedDoctorSnapshot } from '../../domain/doctor-snapshot';
import { computeAfterHashV2 } from '../../../../infrastructure/audit/audit-hash.util';

/**
 * Tamper-evidence adapter for doctors. Uses the centralized AuditAnchor
 * Merkle batch for on-chain integrity verification. Unified staff+doctor
 * snapshot is hashed, persisted on DoctorProfile, and recorded in
 * BlockchainLogger.
 */
@Injectable()
export class BlockchainDoctorIntegrityAnchor implements DoctorIntegrityAnchorPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLoggerService,
    private readonly auditAnchor: AuditAnchorService,
  ) {}

  async anchorChange(doctor: any, action: DoctorAnchorAction, actorId?: string, before?: unknown): Promise<void> {
    const snapshot = buildUnifiedDoctorSnapshot(doctor);

    try {
      if (action !== 'DELETE') {
        const { salt, hash } = this.audit.hashSnapshot(snapshot);
        await this.prisma.doctorProfile.update({ where: { id: doctor.id }, data: { hash256: hash, dataSalt: salt } });
      }
    } catch (err) {
      console.error('Error computing doctor hash:', err);
    }

    await this.audit.recordV2({
      entity: 'DoctorProfile',
      entityId: doctor.id,
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

  async evaluate(doctor: any, skipChainCheck = false): Promise<DoctorIntegrityEvaluation> {
    const snapshot = buildUnifiedDoctorSnapshot(doctor);
    const recomputed = doctor.dataSalt ? this.audit.recompute(snapshot, doctor.dataSalt) : null;
    const dbHash = doctor.hash256 || null;
    const dbMatches = recomputed !== null && recomputed === dbHash;
    const currentAfterHash = computeAfterHashV2('DoctorProfile', doctor.id, snapshot);

    const latestAnchored = await this.prisma.blockchainLogger.findFirst({
      where: { entity: 'DoctorProfile', entityId: doctor.id, batchId: { not: null } },
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
          if (proof && proof.verified) {
            chainMatches = latestAnchored.afterHash === currentAfterHash;
          }
        } catch { /* proof verification failed */ }
      }
    }

    // Latest log entry overall (regardless of anchor status). Used to detect the window
    // between a write and the next Merkle batch (anchored every ~5 min) so we don't
    // mislabel a freshly-edited-but-not-yet-anchored record as TAMPERED.
    const latestAny = await this.prisma.blockchainLogger.findFirst({
      where: { entity: 'DoctorProfile', entityId: doctor.id },
      orderBy: { seq: 'desc' },
      select: { seq: true, afterHash: true, batchId: true },
    });

    let status: 'VERIFIED' | 'TAMPERED' | 'UNANCHORED' | 'PENDING_ANCHOR';
    if (!latestAny) {
      status = 'UNANCHORED';
    } else if (!latestAnchored || (latestAny.seq !== latestAnchored.seq && latestAny.afterHash === currentAfterHash)) {
      // A newer (or first-ever) log exists that isn't anchored yet, and its
      // audited after-snapshot matches the current DB row.
      status = dbMatches ? 'PENDING_ANCHOR' : 'TAMPERED';
    } else if (dbMatches && chainMatches) {
      status = 'VERIFIED';
    } else {
      status = 'TAMPERED';
    }

    if (status === 'TAMPERED') {
      await this.auditAnchor.sendTelegramAlert(
        'Phát hiện giả mạo thông tin bác sĩ',
        `Bác sĩ ID: ${doctor.id} (Chuyên khoa: ${doctor.specialty}, Số CCHN: ${doctor.licenseNumber})\n` +
        `• Hash CSDL: ${dbHash}\n` +
        `• Hash Audit đã neo: ${latestAnchored?.afterHash}\n` +
        `• So khớp DB: ${dbMatches ? 'Khớp' : 'LỆCH'}\n` +
        `• So khớp Chain: ${chainMatches ? 'Khớp' : 'LỆCH'}`
      );
    }

    return {
      id: doctor.id,
      staffProfileId: doctor.staffProfileId,
      specialty: doctor.specialty,
      licenseNumber: doctor.licenseNumber,
      status,
      dbMatches,
      chainMatches,
      recomputedHash: recomputed,
      storedHash: dbHash,
      onChainHash: latestAnchored?.afterHash ?? null,
    };
  }

  history(id?: string) {
    return this.audit.history('DoctorProfile', id);
  }
}

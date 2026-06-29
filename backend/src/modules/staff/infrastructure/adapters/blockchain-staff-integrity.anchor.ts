import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { AuditLoggerService } from '../../../../infrastructure/audit/audit-logger.service';
import { AuditAnchorService } from '../../../../infrastructure/audit/audit-anchor.service';
import {
  StaffIntegrityAnchorPort,
  StaffIntegrityEvaluation,
} from '../../application/ports/staff-integrity-anchor.port';
import { AuditAction } from '../../../../infrastructure/audit/audit-logger.service';
import { computeAfterHashV2 } from '../../../../infrastructure/audit/audit-hash.util';
import { buildStaffSnapshot } from '../../domain/staff-snapshot';
import { buildUnifiedDoctorSnapshot } from '../../../doctor/domain/doctor-snapshot';

/**
 * Tamper-evidence adapter for staff profiles. Uses the centralized AuditAnchor
 * Merkle batch for on-chain integrity verification.
 *
 * When evaluating a staff profile that has a linked doctorProfile, this adapter
 * delegates to the unified doctor snapshot so that the hash matches the one
 * recorded under the doctor's audit log entity.
 */
@Injectable()
export class BlockchainStaffIntegrityAnchor implements StaffIntegrityAnchorPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLoggerService,
    private readonly auditAnchor: AuditAnchorService,
  ) {}

  async anchorChange(staff: any, action: AuditAction, actorId?: string, before?: unknown): Promise<void> {
    const snapshot = buildStaffSnapshot(staff);

    try {
      if (action !== 'DELETE') {
        const { salt, hash } = this.audit.hashSnapshot(snapshot);
        await this.prisma.staffProfile.update({ where: { id: staff.id }, data: { hash256: hash, dataSalt: salt } });
      }
    } catch {
      // Hash computation failed; log entry will still be created below with null hashes.
    }

    await this.audit.recordV2({
      entity: 'StaffProfile',
      entityId: staff.id,
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

  async evaluate(staff: any, skipChainCheck = false): Promise<StaffIntegrityEvaluation> {
    // If this staff member is also a doctor, delegate to unified doctor verification
    if (staff.doctorProfile) {
      return this.evaluateDoctor(staff, skipChainCheck);
    }

    const snapshot = buildStaffSnapshot(staff);
    const recomputed = staff.dataSalt ? this.audit.recompute(snapshot, staff.dataSalt) : null;
    const dbHash = staff.hash256 || null;
    const dbMatches = recomputed !== null && recomputed === dbHash;
    const currentAfterHash = computeAfterHashV2('StaffProfile', staff.id, snapshot);

    const latestAnchored = await this.prisma.blockchainLogger.findFirst({
      where: { entity: 'StaffProfile', entityId: staff.id, batchId: { not: null } },
      orderBy: { seq: 'desc' },
      select: { seq: true, afterHash: true, batchId: true },
    });

    // Latest log entry overall (regardless of anchor status). Used to detect the window
    // between a write and the next Merkle batch (anchored every ~5 min) so we don't
    // mislabel a freshly-edited-but-not-yet-anchored record as TAMPERED.
    const latestAny = await this.prisma.blockchainLogger.findFirst({
      where: { entity: 'StaffProfile', entityId: staff.id },
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
        'Phát hiện giả mạo thông tin nhân viên',
        `Nhân viên: ${staff.fullName} (Mã: ${staff.employeeCode}, ID: ${staff.id})\n` +
        `• Hash CSDL: ${dbHash}\n` +
        `• Hash Audit đã neo: ${latestAnchored?.afterHash}\n` +
        `• So khớp DB: ${dbMatches ? 'Khớp' : 'LỆCH'}\n` +
        `• So khớp Chain: ${chainMatches ? 'Khớp' : 'LỆCH'}`
      );
    }

    return {
      id: staff.id,
      employeeCode: staff.employeeCode,
      fullName: staff.fullName,
      status,
      dbMatches,
      chainMatches,
      recomputedHash: recomputed,
      storedHash: dbHash,
      onChainHash: latestAnchored?.afterHash ?? null,
    };
  }

  /**
   * Evaluate a staff member who is also a doctor using the unified doctor snapshot.
   * The doctor's audit log is stored under entity='DoctorProfile', entityId=doctor.id.
   */
  private async evaluateDoctor(staff: any, skipChainCheck = false): Promise<StaffIntegrityEvaluation> {
    const doctor = staff.doctorProfile;
    const doctorWithStaff = {
      ...doctor,
      staffProfile: { ...staff, doctorProfile: undefined },
    };
    const snapshot = buildUnifiedDoctorSnapshot(doctorWithStaff);
    const recomputed = doctor.dataSalt ? this.audit.recompute(snapshot, doctor.dataSalt) : null;
    const dbHash = doctor.hash256 || null;
    const dbMatches = recomputed !== null && recomputed === dbHash;
    const currentAfterHash = computeAfterHashV2('DoctorProfile', doctor.id, snapshot);

    const latestAnchored = await this.prisma.blockchainLogger.findFirst({
      where: { entity: 'DoctorProfile', entityId: doctor.id, batchId: { not: null } },
      orderBy: { seq: 'desc' },
      select: { seq: true, afterHash: true, batchId: true },
    });

    const latestAny = await this.prisma.blockchainLogger.findFirst({
      where: { entity: 'DoctorProfile', entityId: doctor.id },
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

    let status: 'VERIFIED' | 'TAMPERED' | 'UNANCHORED' | 'PENDING_ANCHOR';
    if (!latestAny) {
      status = 'UNANCHORED';
    } else if (!latestAnchored || (latestAny.seq !== latestAnchored.seq && latestAny.afterHash === currentAfterHash)) {
      status = dbMatches ? 'PENDING_ANCHOR' : 'TAMPERED';
    } else if (dbMatches && chainMatches) {
      status = 'VERIFIED';
    } else {
      status = 'TAMPERED';
    }

    if (status === 'TAMPERED') {
      await this.auditAnchor.sendTelegramAlert(
        'Phát hiện giả mạo thông tin bác sĩ (Staff)',
        `Bác sĩ: ${staff.fullName} (Mã: ${staff.employeeCode}, ID: ${staff.id})\n` +
        `• Hash CSDL: ${dbHash}\n` +
        `• Hash Audit đã neo: ${latestAnchored?.afterHash}\n` +
        `• So khớp DB: ${dbMatches ? 'Khớp' : 'LỆCH'}\n` +
        `• So khớp Chain: ${chainMatches ? 'Khớp' : 'LỆCH'}`
      );
    }

    return {
      id: staff.id,
      employeeCode: staff.employeeCode,
      fullName: staff.fullName,
      status,
      dbMatches,
      chainMatches,
      recomputedHash: recomputed,
      storedHash: dbHash,
      onChainHash: latestAnchored?.afterHash ?? null,
    };
  }

  history(id?: string) {
    return this.audit.history('StaffProfile', id);
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { AuditLoggerService } from '../../../../infrastructure/audit';
import { AuditAnchorService, AuditPageIntegrityService } from '../../../../infrastructure/audit';
import {
  StaffIntegrityAnchorPort,
  StaffIntegrityEvaluation,
} from '../../application/ports/staff-integrity-anchor.port';
import { AuditAction } from '../../../../infrastructure/audit';
import { computeAfterHashV2 } from '../../../../infrastructure/audit';
import { buildStaffSnapshot } from '../../domain/staff-snapshot';
import { buildUnifiedDoctorSnapshot } from '../../../doctor/domain/doctor-snapshot';
import { Prisma } from '@prisma/client';

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
    private readonly pageIntegrity?: AuditPageIntegrityService,
  ) {}

  async anchorChange(
    staff: any,
    action: AuditAction,
    actorId?: string,
    before?: unknown,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const snapshot = buildStaffSnapshot(staff);
    const { salt, hash } = this.audit.hashSnapshot(snapshot);
    const client = tx ?? this.prisma;
    await client.staffProfile.update({ where: { id: staff.id }, data: { hash256: hash, dataSalt: salt } });

    await this.audit.recordV2({
      entity: 'StaffProfile',
      entityId: staff.id,
      action,
      actorId,
      before: this.toAuditSnapshot(before),
      after: snapshot,
      onChainStatus: 'PENDING',
    }, tx);
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
      status = latestAny.afterHash === currentAfterHash ? 'PENDING_ANCHOR' : 'TAMPERED';
    } else if (chainMatches) {
      status = 'VERIFIED';
      if (!dbMatches && staff.id) {
        const { salt: newSalt, hash: newHash } = this.audit.hashSnapshot(snapshot);
        this.prisma.staffProfile.update({ where: { id: staff.id }, data: { hash256: newHash, dataSalt: newSalt } }).catch(() => {});
      }
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
      status = latestAny.afterHash === currentAfterHash ? 'PENDING_ANCHOR' : 'TAMPERED';
    } else if (chainMatches) {
      status = 'VERIFIED';
      if (!dbMatches && doctor.id) {
        const { salt: newSalt, hash: newHash } = this.audit.hashSnapshot(snapshot);
        this.prisma.doctorProfile.update({ where: { id: doctor.id }, data: { hash256: newHash, dataSalt: newSalt } }).catch(() => {});
      }
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

  async evaluateMany(staffItems: any[]): Promise<StaffIntegrityEvaluation[]> {
    const prepared = staffItems.map((staff) => {
      if (staff.doctorProfile) {
        const doctor = staff.doctorProfile;
        const snapshot = buildUnifiedDoctorSnapshot({
          ...doctor,
          staffProfile: { ...staff, doctorProfile: undefined },
        });
        const recomputedHash = doctor.dataSalt ? this.audit.recompute(snapshot, doctor.dataSalt) : null;
        const storedHash = doctor.hash256 || null;
        return {
          staff,
          target: {
            id: staff.id,
            entity: 'DoctorProfile',
            entityId: doctor.id,
            currentAfterHash: computeAfterHashV2('DoctorProfile', doctor.id, snapshot),
            storedHash,
            recomputedHash,
            dbMatches: recomputedHash !== null && recomputedHash === storedHash,
          },
        };
      }
      const snapshot = buildStaffSnapshot(staff);
      const recomputedHash = staff.dataSalt ? this.audit.recompute(snapshot, staff.dataSalt) : null;
      const storedHash = staff.hash256 || null;
      return {
        staff,
        target: {
          id: staff.id,
          entity: 'StaffProfile',
          entityId: staff.id,
          currentAfterHash: computeAfterHashV2('StaffProfile', staff.id, snapshot),
          storedHash,
          recomputedHash,
          dbMatches: recomputedHash !== null && recomputedHash === storedHash,
        },
      };
    });
    const verified = await this.pageIntegrity!.evaluate(prepared.map(({ target }) => target));
    return prepared.map(({ staff }) => {
      const result = verified.get(staff.id)!;
      return {
        id: staff.id,
        employeeCode: staff.employeeCode,
        fullName: staff.fullName,
        status: result.status,
        dbMatches: result.dbMatches,
        chainMatches: result.chainMatches,
        recomputedHash: result.recomputedHash,
        storedHash: result.storedHash,
        onChainHash: result.onChainHash,
      };
    });
  }

  history(id?: string) {
    return this.audit.history('StaffProfile', id);
  }
}

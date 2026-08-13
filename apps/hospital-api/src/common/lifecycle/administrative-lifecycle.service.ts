import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OperationalStatus, UserStatus } from '@prisma/client';
import { AuditLoggerService } from '../../infrastructure/audit/audit-logger.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { EntityRecoveryService } from '../../infrastructure/audit/entity-recovery.service';
import { buildAiModelSnapshot } from '../../modules/ai-model/domain/ai-model-snapshot';
import { buildDepartmentSnapshot } from '../../modules/department/domain/department-snapshot';
import { buildStaffSnapshot } from '../../modules/staff/domain/staff-snapshot';
import { buildUnifiedDoctorSnapshot } from '../../modules/doctor/domain/doctor-snapshot';

type LifecycleEntity = 'ai-models' | 'staff' | 'doctors' | 'departments';

const RESTORE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class AdministrativeLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLoggerService,
    private readonly entityRecovery: EntityRecoveryService,
  ) {}

  async softDelete(entity: LifecycleEntity, id: string, actorId: string) {
    const current = await this.find(entity, id);
    if (!current) throw new NotFoundException('Không tìm thấy bản ghi.');
    await this.entityRecovery.assertTrusted(this.auditEntity(entity), id);
    if (this.statusOf(entity, current) === 'DELETE') throw new ConflictException('Bản ghi đã được xóa trước đó.');
    if (entity === 'departments') {
      const department: any = current;
      const businessReferences = department._count.staffs + department._count.visits + department._count.medicalOrders + department._count.appointments;
      if (businessReferences > 0 && department.status !== OperationalStatus.INACTIVE) {
        throw new ConflictException('Phòng ban có dữ liệu phải chuyển sang ngừng hoạt động trước khi xóa mềm.');
      }
    }
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const after = await this.updateLifecycle(tx, entity, current, UserStatus.DELETE, OperationalStatus.DELETE, {
        deletedAt: now, deletedBy: actorId, restoredAt: null,
      });
      const afterSnapshot = this.snapshot(entity, after);
      const { salt, hash } = this.audit.hashSnapshot(afterSnapshot);
      await this.updateIntegrityHash(tx, entity, id, hash, salt);
      await this.audit.recordV2({ entity: this.auditEntity(entity), entityId: id, action: 'DELETE', actorId, before: this.snapshot(entity, current), after: afterSnapshot }, tx);
      return after;
    });
    return { deleted: true, id, status: 'DELETE', deletedAt: now };
  }

  async restore(entity: LifecycleEntity, id: string, actorId: string) {
    const current = await this.find(entity, id);
    if (!current || this.statusOf(entity, current) !== 'DELETE') throw new NotFoundException('Không tìm thấy bản ghi đã xóa.');
    await this.entityRecovery.assertTrusted(this.auditEntity(entity), id);
    const deletedAt = this.deletedAtOf(entity, current);
    if (!deletedAt || Date.now() - deletedAt.getTime() > RESTORE_WINDOW_MS) {
      throw new ConflictException('Bản ghi đã quá thời hạn khôi phục 30 ngày hoặc thiếu thời điểm xóa hợp lệ.');
    }
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const after = await this.updateLifecycle(tx, entity, current, UserStatus.INACTIVE, OperationalStatus.INACTIVE, {
        deletedAt: null, deletedBy: null, restoredAt: now,
      });
      const afterSnapshot = this.snapshot(entity, after);
      const { salt, hash } = this.audit.hashSnapshot(afterSnapshot);
      await this.updateIntegrityHash(tx, entity, id, hash, salt);
      await this.audit.recordV2({ entity: this.auditEntity(entity), entityId: id, action: 'RESTORE', actorId, before: this.snapshot(entity, current), after: afterSnapshot }, tx);
    });
    return { restored: true, id, status: 'INACTIVE', restoredAt: now };
  }

  async permanentDelete(entity: LifecycleEntity, id: string, actorId: string) {
    const current = await this.find(entity, id);
    if (!current || this.statusOf(entity, current) !== 'DELETE') throw new NotFoundException('Không tìm thấy bản ghi đã xóa.');
    await this.entityRecovery.assertTrusted(this.auditEntity(entity), id);
    const references = await this.referenceCount(entity, current);
    if (references > 0) throw new ConflictException(`Không thể xóa vĩnh viễn vì bản ghi còn ${references} dữ liệu nghiệp vụ liên quan.`);
    const row: any = current;
    await this.prisma.$transaction(async (tx) => {
      await this.audit.recordV2({
        entity: 'AdministrativeDeletion',
        entityId: id,
        action: 'PERMANENT_DELETE',
        actorId,
        before: this.permanentDeletionSnapshot(entity, current),
        after: null,
        metadata: { targetEntity: this.auditEntity(entity) },
      }, tx);
      // Entity FKs are not part of the V2 entry hash. Allow PostgreSQL's
      // onDelete:SetNull actions for this audited administrative operation while
      // keeping actorId and every hash-committed audit column unchanged.
      await tx.$executeRaw`SELECT set_config('app.audit_recovery_authorized', 'true', true)`;
      if (entity === 'ai-models') await tx.aiModelRegistry.delete({ where: { id } });
      if (entity === 'departments') await tx.department.delete({ where: { id } });
      // User is an immutable audit actor (BlockchainLogger.actorId uses Restrict).
      // Keep the already soft-deleted account as a tombstone and remove only the
      // business profile. Recovery can safely relink the same User later.
      if (entity === 'staff') await tx.staffProfile.delete({ where: { id } });
      if (entity === 'doctors') await tx.staffProfile.delete({ where: { id: row.staffProfileId } });
    });
    return { permanentlyDeleted: true, id };
  }

  async softDeleteMany(entity: LifecycleEntity, ids: string[], actorId: string) {
    const unique = [...new Set(ids)];
    const results = await Promise.all(
      unique.map(async (id) => {
        try {
          const r = await this.softDelete(entity, id, actorId);
          return { id, status: 'DELETED' as const, deletedAt: r.deletedAt };
        } catch (err) {
          return { id, status: 'FAILED' as const, message: this.safeMessage(err) };
        }
      }),
    );
    return this.summarizeBulk(results);
  }

  async restoreMany(entity: LifecycleEntity, ids: string[], actorId: string) {
    const unique = [...new Set(ids)];
    const results = await Promise.all(
      unique.map(async (id) => {
        try {
          const r = await this.restore(entity, id, actorId);
          return { id, status: 'RESTORED' as const, restoredAt: r.restoredAt };
        } catch (err) {
          return { id, status: 'FAILED' as const, message: this.safeMessage(err) };
        }
      }),
    );
    return this.summarizeBulk(results);
  }

  async permanentDeleteMany(entity: LifecycleEntity, ids: string[], actorId: string) {
    const unique = [...new Set(ids)];
    const results = await Promise.all(
      unique.map(async (id) => {
        try {
          await this.permanentDelete(entity, id, actorId);
          return { id, status: 'PERMANENTLY_DELETED' as const };
        } catch (err) {
          return { id, status: 'FAILED' as const, message: this.safeMessage(err) };
        }
      }),
    );
    return this.summarizeBulk(results);
  }


  private find(entity: LifecycleEntity, id: string) {
    if (entity === 'ai-models') return this.prisma.aiModelRegistry.findUnique({ where: { id }, include: { _count: { select: { diagnoses: true, aiQualities: true, blockchainLogs: true } } } });
    if (entity === 'departments') return this.prisma.department.findUnique({ where: { id }, include: { _count: { select: { staffs: true, visits: true, medicalOrders: true, appointments: true, blockchainLogs: true } } } });
    if (entity === 'staff') return this.prisma.staffProfile.findUnique({ where: { id }, include: { user: true, _count: { select: { assignedVisits: true, blockchainLogs: true } }, doctorProfile: true, managedDepartment: true } });

    return this.prisma.doctorProfile.findUnique({
      where: { id },
      include: {
        staffProfile: { include: { user: true, managedDepartment: true, _count: { select: { assignedVisits: true } } } },
        _count: { select: { aiQualities: true, medicalOrders: true, appointments: true, reviewedAiDiagnoses: true, medicalConclusions: true, blockchainLogs: true } },
      },
    });
  }

  private async updateLifecycle(tx: any, entity: LifecycleEntity, current: any, userStatus: UserStatus, operationalStatus: OperationalStatus, metadata: any) {
    if (entity === 'ai-models') return tx.aiModelRegistry.update({ where: { id: current.id }, data: { status: operationalStatus, isDeleted: operationalStatus === OperationalStatus.DELETE, ...metadata } });
    if (entity === 'departments') return tx.department.update({ where: { id: current.id }, data: { status: operationalStatus, ...metadata } });
    const userId = entity === 'staff' ? current.userId : current.staffProfile.userId;
    await tx.user.update({ where: { id: userId }, data: { status: userStatus, ...metadata } });
    if (entity === 'staff') return tx.staffProfile.findUniqueOrThrow({ where: { id: current.id }, include: { user: true } });
    return tx.doctorProfile.findUniqueOrThrow({ where: { id: current.id }, include: { staffProfile: { include: { user: true } } } });
  }

  private async updateIntegrityHash(tx: any, entity: LifecycleEntity, id: string, hash256: string, dataSalt: string) {
    const data = { hash256, dataSalt };
    if (entity === 'departments') return tx.department.update({ where: { id }, data });
    if (entity === 'ai-models') return tx.aiModelRegistry.update({ where: { id }, data });
    if (entity === 'staff') return tx.staffProfile.update({ where: { id }, data });
    return tx.doctorProfile.update({ where: { id }, data });
  }

  private statusOf(entity: LifecycleEntity, row: any) { return entity === 'staff' ? row.user.status : entity === 'doctors' ? row.staffProfile.user.status : row.status; }
  private deletedAtOf(entity: LifecycleEntity, row: any): Date | null { return entity === 'staff' ? row.user.deletedAt : entity === 'doctors' ? row.staffProfile.user.deletedAt : row.deletedAt; }
  private auditEntity(entity: LifecycleEntity) { return ({ 'ai-models': 'AiModelRegistry', staff: 'StaffProfile', doctors: 'DoctorProfile', departments: 'Department' } as const)[entity]; }
  private snapshot(entity: LifecycleEntity, row: any) {
    if (entity === 'ai-models') return buildAiModelSnapshot(row);
    if (entity === 'departments') return buildDepartmentSnapshot(row);
    if (entity === 'staff') return buildStaffSnapshot(row);
    return buildUnifiedDoctorSnapshot(row);
  }

  /**
   * Permanent deletion needs more than the integrity snapshot: deleting a
   * Staff/Doctor cascades through User, while AiModelRegistry has required
   * encrypted fields that are intentionally absent from its display snapshot.
   * This envelope is stored only inside beforeEncrypted and is authenticated by
   * the V2 audit hashes before it can be used for recreation.
   */
  private permanentDeletionSnapshot(entity: LifecycleEntity, row: any) {
    const business = this.snapshot(entity, row);
    const user = entity === 'staff' ? row.user : entity === 'doctors' ? row.staffProfile.user : null;
    const staff = entity === 'staff' ? row : entity === 'doctors' ? row.staffProfile : null;
    return {
      ...business,
      _recovery: {
        schema: 'KLTN_ENTITY_RECOVERY_V1',
        targetEntity: this.auditEntity(entity),
        user: user ? {
          id: user.id,
          username: user.username ?? null,
          email: user.email ?? null,
          phone: user.phone ?? null,
          phoneNormalized: user.phoneNormalized ?? null,
          passwordHash: user.passwordHash ?? null,
          role: user.role,
          status: user.status,
          firstLogin: user.firstLogin,
          registrationStep: user.registrationStep,
          tokenVersion: user.tokenVersion,
          faceEmbedding: user.faceEmbedding ?? null,
          faceHash: user.faceHash ?? null,
          faceModelVersion: user.faceModelVersion ?? null,
          faceEnrolledAt: this.iso(user.faceEnrolledAt),
          faceSampleCount: user.faceSampleCount ?? null,
        } : null,
        staff: staff ? {
          userId: staff.userId,
          labSpecialty: staff.labSpecialty ?? null,
          createdAt: this.iso(staff.createdAt),
        } : null,
        entity: entity === 'ai-models' ? {
          modelId: row.modelId,
          ipHashEncrypted: row.ipHashEncrypted,
          isActiveOnChain: row.isActiveOnChain,
          createdAt: this.iso(row.createdAt),
        } : entity === 'departments' ? {
          createdAt: this.iso(row.createdAt),
        } : entity === 'doctors' ? {
          createdAt: this.iso(row.createdAt),
        } : null,
      },
    };
  }

  private iso(value: unknown): string | null {
    if (value instanceof Date) return value.toISOString();
    return typeof value === 'string' ? value : null;
  }
  private async referenceCount(entity: LifecycleEntity, row: any) {
    if (entity === 'ai-models') return row._count.diagnoses + row._count.aiQualities;
    if (entity === 'departments') return row._count.staffs + row._count.visits + row._count.medicalOrders + row._count.appointments;
    if (entity === 'staff') return row._count.assignedVisits + Number(Boolean(row.doctorProfile)) + Number(Boolean(row.managedDepartment));
    return row._count.aiQualities + row._count.medicalOrders + row._count.appointments
      + row._count.reviewedAiDiagnoses + row._count.medicalConclusions
      + row.staffProfile._count.assignedVisits + Number(Boolean(row.staffProfile.managedDepartment));
  }

  private summarizeBulk(results: Array<{ id: string; status: string; [key: string]: unknown }>) {
    return {
      requested: results.length,
      succeeded: results.filter((r) => r.status !== 'FAILED').length,
      failed: results.filter((r) => r.status === 'FAILED').length,
      results,
    };
  }

  private safeMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === 'object' && err !== null && 'message' in err) return String((err as { message: unknown }).message);
    return 'Lỗi không xác định.';
  }
}

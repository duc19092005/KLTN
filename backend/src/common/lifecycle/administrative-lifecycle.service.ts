import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OperationalStatus, UserStatus } from '@prisma/client';
import { AuditLoggerService } from '../../infrastructure/audit/audit-logger.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

type LifecycleEntity = 'ai-models' | 'staff' | 'doctors' | 'departments';

const RESTORE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class AdministrativeLifecycleService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditLoggerService) {}

  async softDelete(entity: LifecycleEntity, id: string, actorId: string) {
    const current = await this.find(entity, id);
    if (!current) throw new NotFoundException('Không tìm thấy bản ghi.');
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
      await this.audit.recordV2({ entity: this.auditEntity(entity), entityId: id, action: 'DELETE', actorId, before: this.snapshot(entity, current), after: this.snapshot(entity, after) }, tx);
      return after;
    });
    return { deleted: true, id, status: 'DELETE', deletedAt: now };
  }

  async restore(entity: LifecycleEntity, id: string, actorId: string) {
    const current = await this.find(entity, id);
    if (!current || this.statusOf(entity, current) !== 'DELETE') throw new NotFoundException('Không tìm thấy bản ghi đã xóa.');
    const deletedAt = this.deletedAtOf(entity, current);
    if (!deletedAt || Date.now() - deletedAt.getTime() > RESTORE_WINDOW_MS) {
      throw new ConflictException('Bản ghi đã quá thời hạn khôi phục 30 ngày hoặc thiếu thời điểm xóa hợp lệ.');
    }
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const after = await this.updateLifecycle(tx, entity, current, UserStatus.INACTIVE, OperationalStatus.INACTIVE, {
        deletedAt: null, deletedBy: null, restoredAt: now,
      });
      await this.audit.recordV2({ entity: this.auditEntity(entity), entityId: id, action: 'RESTORE', actorId, before: this.snapshot(entity, current), after: this.snapshot(entity, after) }, tx);
    });
    return { restored: true, id, status: 'INACTIVE', restoredAt: now };
  }

  async permanentDelete(entity: LifecycleEntity, id: string, actorId: string) {
    const current = await this.find(entity, id);
    if (!current || this.statusOf(entity, current) !== 'DELETE') throw new NotFoundException('Không tìm thấy bản ghi đã xóa.');
    const references = await this.referenceCount(entity, current);
    if (references > 0) throw new ConflictException(`Không thể xóa vĩnh viễn vì bản ghi còn ${references} dữ liệu nghiệp vụ liên quan.`);
    const row: any = current;
    await this.prisma.$transaction(async (tx) => {
      await this.audit.recordV2({
        entity: 'AdministrativeDeletion',
        entityId: id,
        action: 'PERMANENT_DELETE',
        actorId,
        before: this.snapshot(entity, current),
        after: null,
        metadata: { targetEntity: this.auditEntity(entity) },
      }, tx);
      if (entity === 'ai-models') await tx.aiModelRegistry.delete({ where: { id } });
      if (entity === 'departments') await tx.department.delete({ where: { id } });
      if (entity === 'staff') await tx.user.delete({ where: { id: row.userId } });
      if (entity === 'doctors') await tx.user.delete({ where: { id: row.staffProfile.userId } });
    });
    return { permanentlyDeleted: true, id };
  }

  private find(entity: LifecycleEntity, id: string) {
    if (entity === 'ai-models') return this.prisma.aiModelRegistry.findUnique({ where: { id }, include: { _count: { select: { diagnoses: true, aiQualities: true, blockchainLogs: true } } } });
    if (entity === 'departments') return this.prisma.department.findUnique({ where: { id }, include: { _count: { select: { staffs: true, visits: true, medicalOrders: true, appointments: true, blockchainLogs: true } } } });
    if (entity === 'staff') return this.prisma.staffProfile.findUnique({ where: { id }, include: { user: true, _count: { select: { assignedVisits: true, blockchainLogs: true } }, doctorProfile: true, managedDepartment: true } });
    return this.prisma.doctorProfile.findUnique({ where: { id }, include: { staffProfile: { include: { user: true } }, _count: { select: { aiQualities: true, medicalOrders: true, appointments: true, reviewedAiDiagnoses: true, medicalConclusions: true, blockchainLogs: true } } } });
  }

  private async updateLifecycle(tx: any, entity: LifecycleEntity, current: any, userStatus: UserStatus, operationalStatus: OperationalStatus, metadata: any) {
    if (entity === 'ai-models') return tx.aiModelRegistry.update({ where: { id: current.id }, data: { status: operationalStatus, isDeleted: operationalStatus === OperationalStatus.DELETE, ...metadata } });
    if (entity === 'departments') return tx.department.update({ where: { id: current.id }, data: { status: operationalStatus, ...metadata } });
    const userId = entity === 'staff' ? current.userId : current.staffProfile.userId;
    await tx.user.update({ where: { id: userId }, data: { status: userStatus, ...metadata } });
    if (entity === 'staff') return tx.staffProfile.findUniqueOrThrow({ where: { id: current.id }, include: { user: true } });
    return tx.doctorProfile.findUniqueOrThrow({ where: { id: current.id }, include: { staffProfile: { include: { user: true } } } });
  }

  private statusOf(entity: LifecycleEntity, row: any) { return entity === 'staff' ? row.user.status : entity === 'doctors' ? row.staffProfile.user.status : row.status; }
  private deletedAtOf(entity: LifecycleEntity, row: any): Date | null { return entity === 'staff' ? row.user.deletedAt : entity === 'doctors' ? row.staffProfile.user.deletedAt : row.deletedAt; }
  private auditEntity(entity: LifecycleEntity) { return ({ 'ai-models': 'AiModelRegistry', staff: 'StaffProfile', doctors: 'DoctorProfile', departments: 'Department' } as const)[entity]; }
  private snapshot(entity: LifecycleEntity, row: any) { return { id: row.id, status: this.statusOf(entity, row), deletedAt: this.deletedAtOf(entity, row), code: row.modelId ?? row.employeeCode ?? row.departmentCode ?? row.licenseNumber ?? null }; }
  private async referenceCount(entity: LifecycleEntity, row: any) {
    if (entity === 'ai-models') return row._count.diagnoses + row._count.aiQualities;
    if (entity === 'departments') return row._count.staffs + row._count.visits + row._count.medicalOrders + row._count.appointments;
    if (entity === 'staff') return row._count.assignedVisits + Number(Boolean(row.doctorProfile)) + Number(Boolean(row.managedDepartment));
    return row._count.aiQualities + row._count.medicalOrders + row._count.appointments + row._count.reviewedAiDiagnoses + row._count.medicalConclusions;
  }
}

import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  PARACLINICAL_SHIFT_REPOSITORY,
  ParaclinicalShiftRepositoryPort,
} from '../ports/paraclinical-shift.repository.port';
import { AuditLoggerService } from '../../../../infrastructure/audit/audit-logger.service';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';

/**
 * Register a paraclinical shift against a laboratory/imaging department.
 */
@Injectable()
export class RegisterShiftUseCase {
  constructor(
    @Inject(PARACLINICAL_SHIFT_REPOSITORY) private readonly repo: ParaclinicalShiftRepositoryPort,
    private readonly auditLogger: AuditLoggerService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    staffId: string,
    departmentId: string,
    startTime: Date,
    endTime: Date,
    actorId: string,
    note?: string,
    demoMode = false,
  ) {
    if (startTime >= endTime) {
      throw new BadRequestException('Thời gian bắt đầu phải trước thời gian kết thúc.');
    }
    if (!demoMode && startTime < new Date()) {
      throw new BadRequestException('Không thể đăng ký ca trực trong quá khứ.');
    }

    const trimmedNote = note?.trim() || null;
    await this.assertStaffCanWorkInDepartment(staffId, departmentId);
    const shift = await this.repo.createShift({ staffId, departmentId, startTime, endTime, note: trimmedNote });

    const snapshot = {
      staffId,
      departmentId,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      status: 'PENDING',
    };
    const { salt, hash } = this.auditLogger.hashSnapshot(snapshot);

    try {
      await this.repo.setShiftHash(shift.id, hash, salt);
      await this.auditLogger.record({
        entity: 'ParaclinicalShift',
        entityId: shift.id,
        action: 'SHIFT_REGISTERED',
        actorId,
        dataHash: hash,
        dataSalt: salt,
        after: snapshot,
        onChainStatus: 'PENDING',
        metadata: {
          staffName: shift.staff.fullName,
          department: shift.department.name,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          hasNote: Boolean(trimmedNote),
        },
      });
    } catch {
      await this.repo.hardDeleteShift(shift.id).catch(() => undefined);
      throw new BadRequestException('Đăng ký ca trực thất bại khi neo dữ liệu lên blockchain. Vui lòng thử lại.');
    }

    return { ...shift, hash256: hash, dataSalt: salt };
  }

  async resolveDepartment(departmentId: string): Promise<string> {
    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true, type: true },
    });
    if (!department || (department.type !== 'LABORATORY' && department.type !== 'IMAGING')) {
      throw new BadRequestException('Phòng ban không hợp lệ cho ca trực cận lâm sàng.');
    }
    return department.id;
  }

  async resolveStaffId(userIdOrStaffId: string): Promise<string | null> {
    const staff = await this.prisma.staffProfile.findUnique({
      where: { id: userIdOrStaffId },
      select: { id: true },
    });
    if (staff) return staff.id;

    const staffByUser = await this.prisma.staffProfile.findUnique({
      where: { userId: userIdOrStaffId },
      select: { id: true },
    });
    return staffByUser?.id ?? null;
  }

  private async assertStaffCanWorkInDepartment(staffId: string, departmentId: string) {
    const [staff, department] = await Promise.all([
      this.prisma.staffProfile.findUnique({
        where: { id: staffId },
        select: { labSpecialty: true, user: { select: { role: true } } },
      }),
      this.prisma.department.findUnique({
        where: { id: departmentId },
        select: { id: true, type: true, name: true, status: true },
      }),
    ]);

    if (!staff || staff.user.role !== 'LAB_MANAGER') {
      throw new BadRequestException('Chỉ nhân viên cận lâm sàng mới được đăng ký ca trực.');
    }
    if (!department || department.status !== 'ACTIVE' || (department.type !== 'LABORATORY' && department.type !== 'IMAGING')) {
      throw new BadRequestException('Chỉ được đăng ký ca tại khoa xét nghiệm hoặc chẩn đoán hình ảnh đang hoạt động.');
    }

    const specialty = staff.labSpecialty;
    const canWork = !specialty || specialty === 'BOTH' || specialty === department.type;
    if (!canWork) {
      throw new BadRequestException(`Chuyên môn của nhân viên không phù hợp với phòng ban ${department.name}.`);
    }
  }
}

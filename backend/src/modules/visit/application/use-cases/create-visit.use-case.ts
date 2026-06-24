import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateVisitDto } from '../../dto/visit.dto';
import { VISIT_REPOSITORY, VisitRepositoryPort } from '../ports/visit.repository.port';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { NotificationService } from '../../../notification/services/notification.service';
import { AuditLoggerService } from '../../../../infrastructure/audit/audit-logger.service';
import { AuthUser } from '../../../../common/types/auth-user.type';

/**
 * Intake workflow: reception selects an active examination department, then the
 * repository creates the visit and optional patient inside one transaction.
 */
@Injectable()
export class CreateVisitUseCase {
  constructor(
    @Inject(VISIT_REPOSITORY) private readonly repo: VisitRepositoryPort,
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  async execute(dto: CreateVisitDto, user?: AuthUser): Promise<unknown> {
    if (!dto.patientId && !dto.patient) {
      throw new BadRequestException('Vui lòng chọn bệnh nhân hoặc nhập thông tin bệnh nhân mới.');
    }

    const department = await this.repo.findDepartmentForVisit(dto.departmentId);
    if (!department) throw new NotFoundException('Không tìm thấy phòng ban khám.');
    if (department.status !== 'ACTIVE' || department.type !== 'EXAMINATION') {
      throw new BadRequestException('Lễ tân chỉ có thể chọn phòng ban loại phòng khám đang hoạt động.');
    }

    const result = await this.repo.createVisitWithOptionalPatient({
      patientId: dto.patientId,
      patient: dto.patient
        ? {
            fullName: dto.patient.fullName,
            gender: dto.patient.gender,
            birthDate: dto.patient.birthDate,
            citizenId: dto.patient.citizenId,
            phone: dto.patient.phone,
            address: dto.patient.address,
            insuranceNumber: dto.patient.insuranceNumber,
            emergencyContact: dto.patient.emergencyContact,
          }
        : undefined,
      departmentId: dto.departmentId,
    });

    try {
      const visit = result as any;
      if (visit && visit.id) {
        await this.auditLogger.recordV2({
          entity: 'Visit',
          entityId: visit.id,
          action: 'CREATE',
          actorId: user?.sub ?? null,
          before: null,
          after: {
            visitCode: visit.visitCode,
            patientId: visit.patientId,
            departmentId: visit.departmentId,
            staffId: visit.staffId,
            status: visit.status,
          },
          metadata: { schema: 'KLTN_VISIT_CREATE_AUDIT_V2' },
        });
      }
    } catch (err) {
      console.error('Failed to write audit log for visit registration:', err);
    }

    try {
      const visit = result as any;
      if (visit && visit.patient && visit.department) {
        const doctors = await this.prisma.staffProfile.findMany({
          where: {
            departmentId: visit.departmentId,
            user: {
              role: 'DOCTOR',
              status: 'ACTIVE',
            },
          },
          select: {
            userId: true,
          },
        });

        for (const doc of doctors) {
          await this.notificationService.createNotification(
            doc.userId,
            'Lượt khám mới',
            `Bệnh nhân ${visit.patient.fullName} đang chờ khám tại ${visit.department.name}.`,
          );
        }
      }
    } catch (err) {
      console.error('Failed to send visit creation notifications:', err);
    }

    return result;
  }
}

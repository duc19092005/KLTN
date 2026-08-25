import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateVisitDto } from '../../dto/visit.dto';
import { VISIT_REPOSITORY, VisitRepositoryPort } from '../ports/visit.repository.port';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { NotificationService } from '../../../notification/services/notification.service';
import { AuditLoggerService, ClinicalAuditTrustService } from '../../../../infrastructure/audit';
import { buildPatientSnapshot } from '../../../patient/domain/patient-snapshot';
import { AuthUser } from '../../../../common/types/auth-user.type';
import { buildVisitSnapshot } from '../../domain/visit-snapshot';

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
    private readonly clinicalTrust: ClinicalAuditTrustService,
  ) {}

  async execute(dto: CreateVisitDto, user?: AuthUser): Promise<unknown> {
    if (!dto.patientId && !dto.patient) {
      throw new BadRequestException('Vui lòng chọn bệnh nhân hoặc nhập thông tin bệnh nhân mới.');
    }
    if (dto.patientId && dto.patient) {
      throw new BadRequestException('Chỉ được chọn bệnh nhân có sẵn hoặc nhập bệnh nhân mới, không được gửi đồng thời cả hai.');
    }
    if (
      dto.patient &&
      ![dto.patient.phone, dto.patient.citizenId, dto.patient.insuranceNumber, dto.patient.emergencyContact]
        .some((value) => value?.trim())
    ) {
      throw new BadRequestException('Hồ sơ bệnh nhân mới phải có ít nhất một thông tin liên hệ hoặc định danh hợp lệ.');
    }

    const department = await this.repo.findDepartmentForVisit(dto.departmentId);
    if (!department) throw new NotFoundException('Không tìm thấy phòng ban khám.');
    if (department.status !== 'ACTIVE' || department.type !== 'EXAMINATION') {
      throw new BadRequestException('Lễ tân chỉ có thể chọn phòng ban loại phòng khám đang hoạt động.');
    }

    let assignedStaffId = dto.staffId;
    if (assignedStaffId) {
      const doctorStaff = await this.prisma.staffProfile.findFirst({
        where: {
          id: assignedStaffId,
          departmentId: dto.departmentId,
          user: { role: 'DOCTOR', status: 'ACTIVE' },
          doctorProfile: { isNot: null },
        },
        select: { id: true },
      });
      if (!doctorStaff) {
        throw new BadRequestException('Bác sĩ phụ trách không thuộc phòng khám đã chọn hoặc không còn hoạt động.');
      }
    }

    const result = await this.repo.createVisitWithOptionalPatient(
      {
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
        staffId: assignedStaffId ?? null,
      },
      async (visit, tx) => {
        await this.auditLogger.recordV2({
          entity: 'Visit',
          entityId: visit.id,
          action: 'CREATE',
          actorId: user?.sub ?? null,
          before: null,
          after: buildVisitSnapshot(visit),
          metadata: { schema: 'KLTN_VISIT_CREATE_AUDIT_V3' },
        }, tx);
      },
      async (patient, tx) => {
        const snapshot = buildPatientSnapshot(patient);
        const { salt, hash } = this.auditLogger.hashSnapshot(snapshot);
        await tx.patient.update({
          where: { id: patient.id },
          data: { hash256: hash, dataSalt: salt },
        });
        await this.auditLogger.recordV2({
          entity: 'Patient',
          entityId: patient.id,
          action: 'CREATE',
          actorId: user?.sub ?? null,
          before: null,
          after: snapshot,
          metadata: { schema: 'KLTN_PATIENT_CREATE_AUDIT_V2', source: 'VISIT_INTAKE' },
          onChainStatus: 'PENDING',
        }, tx);
      },
      dto.patientId
        ? async (tx) => {
            await this.clinicalTrust.assertTrusted({ entity: 'Patient', entityId: dto.patientId! }, tx);
          }
        : undefined,
    );

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

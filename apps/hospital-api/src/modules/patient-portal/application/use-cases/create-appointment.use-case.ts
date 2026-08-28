import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { AuditLoggerService } from '../../../../infrastructure/audit';
import { CreateAppointmentDto } from '../../patient-booking.dto';
import { buildQrPayload, generateQrToken, getQrExpiry, hashQrToken } from '../../domain/appointment-qr.util';
import { generateAppointmentCode } from '../../domain/patient-code-generator.util';
import { appointmentInclude, toAppointmentSummary } from '../../domain/patient-portal.mapper';
import { PatientPortalAccessService } from '../services/patient-portal-access.service';

@Injectable()
export class CreateAppointmentUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: PatientPortalAccessService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  async execute(userId: string, dto: CreateAppointmentDto) {
    await this.accessService.requireAccess(userId, dto.patientId, 'booking');
    const scheduledAt = new Date(dto.scheduledAt);
    this.accessService.assertBookableScheduledAt(scheduledAt);

    const doctor = await this.prisma.doctorProfile.findUnique({
      where: { id: dto.doctorId },
      include: { staffProfile: { include: { department: true } } },
    });
    if (!doctor || doctor.staffProfile.userId === null || !doctor.staffProfile.departmentId || !doctor.staffProfile.department) {
      throw new BadRequestException('Bác sĩ không hợp lệ để đặt lịch.');
    }
    if (doctor.specialty !== dto.specialty) {
      throw new BadRequestException('Bác sĩ không thuộc chuyên khoa đã chọn.');
    }
    if (doctor.staffProfile.department.status !== 'ACTIVE' || !['EXAMINATION', 'CLINICAL'].includes(doctor.staffProfile.department.type)) {
      throw new BadRequestException('Phòng ban của bác sĩ không hợp lệ để đặt lịch.');
    }
    await this.accessService.assertDoctorSlotAvailable(dto.doctorId, scheduledAt);
    const departmentId = doctor.staffProfile.departmentId;
    const doctorStaffId = doctor.staffProfileId;

    const rawQrToken = generateQrToken();
    const qrTokenHash = hashQrToken(rawQrToken);
    const appointment = await this.prisma.$transaction(async (tx) => {
      const appointmentCode = await generateAppointmentCode(tx);
      const created = await tx.appointment.create({
        data: {
          appointmentCode,
          patientId: dto.patientId,
          departmentId,
          doctorId: dto.doctorId ?? null,
          scheduledAt,
          status: 'CONFIRMED',
          qrTokenHash,
          qrExpiresAt: getQrExpiry(scheduledAt),
          createdByUserId: userId,
        },
        include: appointmentInclude(),
      });

      await this.auditLogger.recordV2(
        {
          entity: 'Appointment',
          entityId: created.id,
          action: 'CREATE',
          actorId: userId,
          before: null,
          after: {
            appointmentCode: created.appointmentCode,
            patientId: created.patientId,
            departmentId: created.departmentId,
            doctorId: created.doctorId,
            scheduledAt: created.scheduledAt,
            status: created.status,
            doctorStaffId,
          },
          metadata: { schema: 'KLTN_APPOINTMENT_CREATE_AUDIT_V1' },
        },
        tx,
      );

      return created;
    });

    return { ...toAppointmentSummary(appointment), qrPayload: buildQrPayload(rawQrToken) };
  }
}
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { VisitSource, VisitStatus } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { AuditLoggerService } from '../../../../infrastructure/audit';
import { AuthUser } from '../../../../common/types/auth-user.type';
import { buildVisitSnapshot } from '../../../visit/domain/visit-snapshot';
import { CheckInAppointmentDto } from '../../patient-booking.dto';
import { extractQrToken, hashQrToken } from '../../domain/appointment-qr.util';
import { generateVisitCode } from '../../domain/patient-code-generator.util';
import { appointmentInclude, toAppointmentSummary } from '../../domain/patient-portal.mapper';
import { PatientPortalAccessService } from '../services/patient-portal-access.service';

@Injectable()
export class CheckInAppointmentUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: PatientPortalAccessService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  async execute(dto: CheckInAppointmentDto, user: AuthUser) {
    const tokenHash = hashQrToken(extractQrToken(dto.qrPayload));
    const result = await this.prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.findUnique({
        where: { qrTokenHash: tokenHash },
        include: appointmentInclude(),
      });
      if (!appointment) throw new NotFoundException('Không tìm thấy lịch hẹn từ mã QR.');
      this.accessService.assertAppointmentCanCheckIn(appointment);
      if (!appointment.department || appointment.department.status !== 'ACTIVE') {
        throw new BadRequestException('Phòng ban của lịch hẹn đang ngừng hoạt động, không thể check-in.');
      }

      const visitCode = await generateVisitCode(tx);
      const visit = await tx.visit.create({
        data: {
          visitCode,
          patientId: appointment.patientId,
          departmentId: appointment.departmentId,
          staffId: appointment.doctor?.staffProfileId ?? null,
          source: VisitSource.APPOINTMENT,
          status: VisitStatus.WAITING,
        },
        include: {
          patient: true,
          department: true,
          staff: true,
        },
      });

      const checkedInAppointment = await tx.appointment.update({
        where: { id: appointment.id },
        data: { status: 'CHECKED_IN', checkedInAt: new Date(), visitId: visit.id },
        include: appointmentInclude(),
      });

      await this.auditLogger.recordV2(
        {
          entity: 'Appointment',
          entityId: checkedInAppointment.id,
          action: 'UPDATE',
          actorId: user.sub,
          before: null,
          after: {
            appointmentCode: checkedInAppointment.appointmentCode,
            status: checkedInAppointment.status,
            visitId: visit.id,
          },
          metadata: { schema: 'KLTN_APPOINTMENT_CHECKIN_AUDIT_V1' },
        },
        tx,
      );

      await this.auditLogger.recordV2(
        {
          entity: 'Visit',
          entityId: visit.id,
          action: 'CREATE',
          actorId: user.sub,
          before: null,
          after: buildVisitSnapshot(visit),
          metadata: { schema: 'KLTN_VISIT_FROM_APPOINTMENT_AUDIT_V2' },
        },
        tx,
      );

      return { appointment: checkedInAppointment, visit };
    });

    return {
      appointment: toAppointmentSummary(result.appointment),
      visit: result.visit,
    };
  }
}
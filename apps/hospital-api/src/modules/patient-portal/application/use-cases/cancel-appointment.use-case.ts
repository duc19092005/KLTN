import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { AuditLoggerService } from '../../../../infrastructure/audit';
import { appointmentInclude, toAppointmentSummary } from '../../domain/patient-portal.mapper';
import { PatientPortalAccessService } from '../services/patient-portal-access.service';

@Injectable()
export class CancelAppointmentUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: PatientPortalAccessService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  async execute(userId: string, appointmentId: string) {
    const appointment = await this.prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!appointment) throw new NotFoundException('Không tìm thấy lịch hẹn.');
    await this.accessService.requireAccess(userId, appointment.patientId, 'booking');
    if (!['PENDING', 'CONFIRMED'].includes(appointment.status)) {
      throw new BadRequestException('Chỉ có thể hủy lịch hẹn chưa check-in.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const cancelled = await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: 'PATIENT_CANCELLED' },
        include: appointmentInclude(),
      });

      await this.auditLogger.recordV2(
        {
          entity: 'Appointment',
          entityId: cancelled.id,
          action: 'UPDATE',
          actorId: userId,
          before: null,
          after: { appointmentCode: cancelled.appointmentCode, status: cancelled.status },
          metadata: { schema: 'KLTN_APPOINTMENT_CANCEL_AUDIT_V1' },
        },
        tx,
      );

      return cancelled;
    });

    return toAppointmentSummary(updated);
  }
}
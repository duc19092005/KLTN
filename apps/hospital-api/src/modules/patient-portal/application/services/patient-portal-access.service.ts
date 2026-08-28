import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { BOOKING_LOOKAHEAD_DAYS } from '../../domain/appointment-qr.util';

@Injectable()
export class PatientPortalAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async requireAccess(userId: string, patientId: string, scope: 'profile' | 'visits' | 'booking') {
    const access = await this.prisma.patientAccess.findUnique({
      where: { userId_patientId: { userId, patientId } },
      include: { patient: true },
    });

    if (!access || access.status !== 'ACTIVE') {
      throw new NotFoundException('Không tìm thấy hồ sơ bệnh nhân được liên kết.');
    }
    if (scope === 'profile' && !access.canViewProfile) {
      throw new ForbiddenException('Tài khoản không có quyền xem hồ sơ này.');
    }
    if (scope === 'booking' && !access.canBookVisit) {
      throw new ForbiddenException('Tài khoản không có quyền đặt lịch cho hồ sơ này.');
    }
    return access;
  }

  async assertDoctorSlotAvailable(doctorId: string, scheduledAt: Date): Promise<void> {
    const existing = await this.prisma.appointment.findFirst({
      where: {
        doctorId,
        scheduledAt,
        status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
      },
      select: { id: true },
    });
    if (existing) throw new BadRequestException('Khung giờ này đã có lịch hẹn. Vui lòng chọn giờ khác.');
  }

  assertBookableScheduledAt(scheduledAt: Date): void {
    if (Number.isNaN(scheduledAt.getTime())) throw new BadRequestException('Thời gian đặt lịch không hợp lệ.');
    const now = new Date();
    if (scheduledAt.getTime() <= now.getTime()) throw new BadRequestException('Thời gian đặt lịch phải ở tương lai.');
    const latest = new Date(now);
    latest.setDate(latest.getDate() + BOOKING_LOOKAHEAD_DAYS);
    if (scheduledAt.getTime() > latest.getTime()) throw new BadRequestException(`Chỉ có thể đặt lịch trong ${BOOKING_LOOKAHEAD_DAYS} ngày tới.`);
  }

  assertAppointmentCanCheckIn(appointment: { status: string; qrExpiresAt: Date; visitId: string | null }): void {
    if (appointment.visitId || appointment.status === 'CHECKED_IN') throw new BadRequestException('Lịch hẹn đã được check-in.');
    if (!['PENDING', 'CONFIRMED'].includes(appointment.status)) throw new BadRequestException('Lịch hẹn không còn hiệu lực.');
    if (appointment.qrExpiresAt.getTime() < Date.now()) throw new BadRequestException('Mã QR lịch hẹn đã hết hạn.');
  }
}
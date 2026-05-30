import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole, VisitStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { getPagination, paginated } from '../../shared/pagination.dto';
import { CreateVisitDto, VisitQueryDto } from '../dto/visit.dto';

type AuthUser = { sub: string; role: UserRole | string };

// Allowed VisitStatus transitions for the direct PATCH /visits/:id/status endpoint.
// Note: automated transitions made by medical-order/clinical-decision services use
// tx.visit.update directly and are intentionally not constrained here.
const ALLOWED_VISIT_TRANSITIONS: Record<VisitStatus, VisitStatus[]> = {
  [VisitStatus.WAITING]: [VisitStatus.IN_PROGRESS, VisitStatus.CANCELLED],
  [VisitStatus.IN_PROGRESS]: [VisitStatus.WAITING_TEST_RESULT, VisitStatus.WAITING_CONCLUSION, VisitStatus.CANCELLED],
  [VisitStatus.WAITING_TEST_RESULT]: [VisitStatus.IN_PROGRESS, VisitStatus.WAITING_CONCLUSION],
  [VisitStatus.WAITING_CONCLUSION]: [VisitStatus.IN_PROGRESS, VisitStatus.COMPLETED],
  [VisitStatus.COMPLETED]: [],
  [VisitStatus.CANCELLED]: [],
};

@Injectable()
export class VisitService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateVisitDto) {
    if (!dto.patientId && !dto.patient) throw new BadRequestException('patientId or patient is required');
    const room = await this.prisma.clinicalRoom.findUnique({ where: { id: dto.clinicalRoomId }, include: { doctor: true } });
    if (!room) throw new NotFoundException('Clinical room not found');
    const doctor = await this.prisma.doctorProfile.findUnique({ where: { id: dto.doctorId } });
    if (!doctor) throw new NotFoundException('Doctor profile not found');
    if (room.doctorId && room.doctorId !== dto.doctorId) throw new BadRequestException('Selected doctor is not assigned to this clinical room');

    // Retry on unique-code collisions: patientCode/visitCode are generated from the
    // latest row, so concurrent intakes can collide. The whole transaction rolls back
    // and regenerates fresh codes on the next attempt.
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          let patientId = dto.patientId;
          if (!patientId && dto.patient) {
            const patientCode = await this.generatePatientCode(tx);
            const patient = await tx.patient.create({ data: {
              patientCode,
              fullName: dto.patient.fullName.trim(),
              gender: dto.patient.gender.trim(),
              birthDate: new Date(dto.patient.birthDate),
              citizenId: dto.patient.citizenId?.trim() || null,
              phone: dto.patient.phone?.trim() || null,
              address: dto.patient.address?.trim() || null,
              insuranceNumber: dto.patient.insuranceNumber?.trim() || null,
              emergencyContact: dto.patient.emergencyContact?.trim() || null,
            } });
            patientId = patient.id;
          }
          if (!patientId) throw new BadRequestException('Patient is required');
          const visitCode = await this.generateVisitCode(tx);
          return tx.visit.create({ data: {
            visitCode,
            patientId,
            clinicalRoomId: dto.clinicalRoomId,
            doctorId: dto.doctorId,
            status: VisitStatus.WAITING,
          }, include: this.includeRelations() });
        });
      } catch (error) {
        if (!this.isUniqueCodeConflict(error) || attempt === maxAttempts) throw error;
      }
    }

    throw new BadRequestException('Cannot generate unique patient/visit code');
  }

  async findAll(query: VisitQueryDto, user?: AuthUser) {
    const { page, limit, skip } = getPagination(query);
    const doctorId = user?.role === UserRole.DOCTOR ? await this.getCurrentDoctorId(user.sub) : query.doctorId;
    const where: Prisma.VisitWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(doctorId ? { doctorId } : {}),
      ...(query.clinicalRoomId ? { clinicalRoomId: query.clinicalRoomId } : {}),
      ...(query.patientId ? { patientId: query.patientId } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.visit.findMany({ where, include: this.includeRelations(), orderBy: { checkInAt: 'asc' }, skip, take: limit }),
      this.prisma.visit.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async updateStatus(id: string, status: VisitStatus, user?: AuthUser) {
    const visit = await this.ensureVisit(id);
    if (user?.role === UserRole.DOCTOR) {
      const doctorId = await this.getCurrentDoctorId(user.sub);
      if (visit.doctorId !== doctorId) {
        throw new ForbiddenException('Doctor can only update status for own visit');
      }
    }
    if (status === VisitStatus.CANCELLED) {
      this.ensureCanCancelVisit(visit, user);
    }
    if (visit.status === VisitStatus.COMPLETED || visit.status === VisitStatus.CANCELLED) {
      throw new BadRequestException('Cannot update a completed/cancelled visit');
    }
    // Enforce the clinical workflow ordering. Same-status calls are treated as
    // idempotent no-ops; any other unlisted jump (e.g. WAITING -> COMPLETED) is rejected.
    if (status !== visit.status && !ALLOWED_VISIT_TRANSITIONS[visit.status].includes(status)) {
      throw new BadRequestException(`Không thể chuyển trạng thái lượt khám từ ${visit.status} sang ${status}`);
    }
    return this.prisma.visit.update({
      where: { id },
      data: {
        status,
        completedAt: status === VisitStatus.COMPLETED || status === VisitStatus.CANCELLED ? new Date() : undefined,
      },
      include: this.includeRelations(),
    });
  }

  async suggestRooms(specialty: string) {
    const where: Prisma.ClinicalRoomWhereInput = {
      status: 'ACTIVE',
      doctor: specialty ? { specialty: { contains: specialty, mode: 'insensitive' } } : { isNot: null },
    };
    return this.prisma.clinicalRoom.findMany({ where, include: { doctor: { include: { staffProfile: { include: { department: true } } } } }, orderBy: { roomCode: 'asc' }, take: 10 });
  }

  private async ensureVisit(id: string) {
    const visit = await this.prisma.visit.findUnique({ where: { id } });
    if (!visit) throw new NotFoundException('Visit not found');
    return visit;
  }

  private isUniqueCodeConflict(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError
      && error.code === 'P2002'
      && Array.isArray(error.meta?.target)
      && (error.meta.target.includes('patientCode') || error.meta.target.includes('visitCode'));
  }

  private ensureCanCancelVisit(visit: Awaited<ReturnType<VisitService['ensureVisit']>>, user?: AuthUser) {
    if (!user || user.role === UserRole.ADMIN) return;
    if (user.role === UserRole.RECEPTIONIST && visit.status !== VisitStatus.WAITING) {
      throw new BadRequestException('Receptionist can only cancel visits before examination starts');
    }
    if (user.role === UserRole.DOCTOR && !([VisitStatus.WAITING, VisitStatus.IN_PROGRESS] as VisitStatus[]).includes(visit.status)) {
      throw new BadRequestException('Doctor can only cancel visits before test orders/results are created');
    }
  }

  private async getCurrentDoctorId(userId: string) {
    const doctor = await this.prisma.doctorProfile.findFirst({ where: { staffProfile: { userId } }, select: { id: true } });
    if (!doctor) throw new ForbiddenException('Current user does not have doctor profile');
    return doctor.id;
  }

  private includeRelations() {
    return {
      patient: true,
      clinicalRoom: true,
      doctor: {
        include: {
          staffProfile: {
            include: {
              department: true,
              user: { select: { id: true, username: true, email: true, role: true, status: true } },
            },
          },
        },
      },
    } as const;
  }

  private async generatePatientCode(tx: Prisma.TransactionClient) {
    const latest = await tx.patient.findFirst({ where: { patientCode: { startsWith: 'BN-' } }, orderBy: { patientCode: 'desc' }, select: { patientCode: true } });
    const lastNumber = Number(latest?.patientCode?.replace('BN-', '') || '0');
    return `BN-${String(lastNumber + 1).padStart(4, '0')}`;
  }

  private async generateVisitCode(tx: Prisma.TransactionClient) {
    const latest = await tx.visit.findFirst({ where: { visitCode: { startsWith: 'VISIT-' } }, orderBy: { visitCode: 'desc' }, select: { visitCode: true } });
    const lastNumber = Number(latest?.visitCode?.replace('VISIT-', '') || '0');
    return `VISIT-${String(lastNumber + 1).padStart(4, '0')}`;
  }
}

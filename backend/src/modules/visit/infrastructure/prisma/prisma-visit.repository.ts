import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, VisitStatus } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import {
  CreateVisitCommand,
  isUniqueVisitCodeConflict,
  VisitEntity,
  VisitListFilter,
  VisitRepositoryPort,
} from '../../application/ports/visit.repository.port';

/**
 * Prisma-backed Visit repository. Keeps the exact include shapes, unique-code
 * generation and the create transaction (with retry) that previously lived in
 * VisitService, so query behavior and response shapes are unchanged.
 */
@Injectable()
export class PrismaVisitRepository implements VisitRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<VisitEntity | null> {
    return this.prisma.visit.findUnique({
      where: { id },
      select: { id: true, patientId: true, doctorId: true, clinicalRoomId: true, status: true },
    });
  }

  async findRoomWithDoctor(roomId: string) {
    return this.prisma.clinicalRoom.findUnique({
      where: { id: roomId },
      select: { id: true, doctorId: true },
    });
  }

  async findDoctorProfileById(doctorId: string) {
    return this.prisma.doctorProfile.findUnique({ where: { id: doctorId }, select: { id: true } });
  }

  async findDoctorIdByUserId(userId: string): Promise<string | null> {
    const doctor = await this.prisma.doctorProfile.findFirst({
      where: { staffProfile: { userId } },
      select: { id: true },
    });
    return doctor?.id ?? null;
  }

  async createVisitWithOptionalPatient(command: CreateVisitCommand): Promise<unknown> {
    // Retry on unique-code collisions: patientCode/visitCode are generated from the
    // latest row, so concurrent intakes can collide. The whole transaction rolls back
    // and regenerates fresh codes on the next attempt.
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          let patientId = command.patientId;
          if (!patientId && command.patient) {
            const patientCode = await this.generatePatientCode(tx);
            const patient = await tx.patient.create({
              data: {
                patientCode,
                fullName: command.patient.fullName.trim(),
                gender: command.patient.gender.trim(),
                birthDate: new Date(command.patient.birthDate),
                citizenId: command.patient.citizenId?.trim() || null,
                phone: command.patient.phone?.trim() || null,
                address: command.patient.address?.trim() || null,
                insuranceNumber: command.patient.insuranceNumber?.trim() || null,
                emergencyContact: command.patient.emergencyContact?.trim() || null,
              },
            });
            patientId = patient.id;
          }
          if (!patientId) throw new BadRequestException('Vui lòng chọn bệnh nhân.');
          const visitCode = await this.generateVisitCode(tx);
          return tx.visit.create({
            data: {
              visitCode,
              patientId,
              clinicalRoomId: command.clinicalRoomId,
              doctorId: command.doctorId,
              status: VisitStatus.WAITING,
            },
            include: this.includeRelations(),
          });
        });
      } catch (error) {
        if (!isUniqueVisitCodeConflict(error) || attempt === maxAttempts) throw error;
      }
    }

    throw new BadRequestException('Không thể tạo mã bệnh nhân hoặc mã lượt khám duy nhất.');
  }

  async findManyPaginated(filter: VisitListFilter, skip: number, take: number) {
    const where: Prisma.VisitWhereInput = {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.doctorId ? { doctorId: filter.doctorId } : {}),
      ...(filter.clinicalRoomId ? { clinicalRoomId: filter.clinicalRoomId } : {}),
      ...(filter.patientId ? { patientId: filter.patientId } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.visit.findMany({ where, include: this.includeRelations(), orderBy: { checkInAt: 'asc' }, skip, take }),
      this.prisma.visit.count({ where }),
    ]);
    return { items, total };
  }

  async updateStatus(id: string, status: VisitStatus, completedAt?: Date) {
    return this.prisma.visit.update({
      where: { id },
      data: { status, completedAt },
      include: this.includeRelations(),
    });
  }

  async suggestRooms(specialty: string) {
    const where: Prisma.ClinicalRoomWhereInput = {
      status: 'ACTIVE',
      doctor: specialty ? { specialty: { contains: specialty, mode: 'insensitive' } } : { isNot: null },
    };
    return this.prisma.clinicalRoom.findMany({
      where,
      include: { doctor: { include: { staffProfile: { include: { department: true } } } } },
      orderBy: { roomCode: 'asc' },
      take: 10,
    });
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

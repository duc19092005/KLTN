import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, VisitStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { getPagination, paginated } from '../../shared/pagination.dto';
import { CreateVisitDto, VisitQueryDto } from '../dto/visit.dto';

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

    return this.prisma.$transaction(async (tx) => {
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
        symptoms: dto.symptoms?.trim(),
        status: VisitStatus.WAITING,
      }, include: this.includeRelations() });
    });
  }

  async findAll(query: VisitQueryDto) {
    const { page, limit, skip } = getPagination(query);
    const where: Prisma.VisitWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.doctorId ? { doctorId: query.doctorId } : {}),
      ...(query.clinicalRoomId ? { clinicalRoomId: query.clinicalRoomId } : {}),
      ...(query.patientId ? { patientId: query.patientId } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.visit.findMany({ where, include: this.includeRelations(), orderBy: { checkInAt: 'asc' }, skip, take: limit }),
      this.prisma.visit.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async updateStatus(id: string, status: VisitStatus) {
    await this.ensureVisit(id);
    return this.prisma.visit.update({ where: { id }, data: { status, completedAt: status === VisitStatus.COMPLETED ? new Date() : undefined }, include: this.includeRelations() });
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

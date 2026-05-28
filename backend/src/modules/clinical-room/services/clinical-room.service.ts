import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { getPagination, paginated } from '../../shared/pagination.dto';
import { AssignRoomDoctorDto, ClinicalRoomQueryDto, CreateClinicalRoomDto, UpdateClinicalRoomDto } from '../dto/clinical-room.dto';

@Injectable()
export class ClinicalRoomService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateClinicalRoomDto, actorId?: string) {
    await this.assertRoomCodeUnique(dto.roomCode);
    if (dto.doctorId) await this.assertDoctorExists(dto.doctorId);

    return this.prisma.$transaction(async (tx) => {
      if (dto.doctorId) {
        await tx.clinicalRoom.updateMany({ where: { doctorId: dto.doctorId }, data: { doctorId: null } });
      }

      return tx.clinicalRoom.create({
        data: {
          roomCode: dto.roomCode.trim(),
          roomName: dto.roomName.trim(),
          doctorId: dto.doctorId || null,
          floor: dto.floor?.trim(),
          description: dto.description?.trim(),
          status: dto.status?.trim() || 'ACTIVE',
        },
        include: this.includeRelations(),
      });
    });
  }

  async findAll(query: ClinicalRoomQueryDto) {
    const { page, limit, skip } = getPagination(query);
    const where: Prisma.ClinicalRoomWhereInput = {
      ...(query.roomCode ? { roomCode: { contains: query.roomCode, mode: 'insensitive' } } : {}),
      ...(query.roomName ? { roomName: { contains: query.roomName, mode: 'insensitive' } } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { roomCode: { contains: query.search, mode: 'insensitive' } },
              { roomName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.clinicalRoom.findMany({ where, include: this.includeRelations(), orderBy: { roomCode: 'asc' }, skip, take: limit }),
      this.prisma.clinicalRoom.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async update(id: string, dto: UpdateClinicalRoomDto, actorId?: string) {
    await this.ensureRoom(id);
    if (dto.roomCode) await this.assertRoomCodeUnique(dto.roomCode, id);
    if (dto.doctorId) await this.assertDoctorExists(dto.doctorId);

    return this.prisma.$transaction(async (tx) => {
      if (dto.doctorId) {
        await tx.clinicalRoom.updateMany({ where: { doctorId: dto.doctorId, id: { not: id } }, data: { doctorId: null } });
      }

      return tx.clinicalRoom.update({
        where: { id },
        data: {
          ...(dto.roomCode !== undefined ? { roomCode: dto.roomCode.trim() } : {}),
          ...(dto.roomName !== undefined ? { roomName: dto.roomName.trim() } : {}),
          ...(dto.doctorId !== undefined ? { doctorId: dto.doctorId || null } : {}),
          ...(dto.floor !== undefined ? { floor: dto.floor?.trim() } : {}),
          ...(dto.description !== undefined ? { description: dto.description?.trim() } : {}),
          ...(dto.status !== undefined ? { status: dto.status.trim() } : {}),
        },
        include: this.includeRelations(),
      });
    });
  }

  async assignDoctor(id: string, dto: AssignRoomDoctorDto, actorId?: string) {
    await this.ensureRoom(id);
    if (dto.doctorId) await this.assertDoctorExists(dto.doctorId);

    return this.prisma.$transaction(async (tx) => {
      if (dto.doctorId) {
        await tx.clinicalRoom.updateMany({ where: { doctorId: dto.doctorId, id: { not: id } }, data: { doctorId: null } });
      }

      return tx.clinicalRoom.update({ where: { id }, data: { doctorId: dto.doctorId || null }, include: this.includeRelations() });
    });
  }

  async remove(id: string, actorId?: string) {
    await this.ensureRoom(id);
    await this.prisma.clinicalRoom.delete({ where: { id } });
    return { deleted: true };
  }

  private includeRelations() {
    return { doctor: { include: { staffProfile: { include: { user: { select: this.safeUserSelect() }, department: true } } } } } as const;
  }

  private async ensureRoom(id: string) {
    const room = await this.prisma.clinicalRoom.findUnique({ where: { id } });
    if (!room) throw new NotFoundException('Clinical room not found');
    return room;
  }

  private async assertRoomCodeUnique(roomCode: string, excludeId?: string) {
    const existing = await this.prisma.clinicalRoom.findUnique({ where: { roomCode: roomCode.trim() } });
    if (existing && existing.id !== excludeId) throw new ConflictException('Room code already exists');
  }

  private async assertDoctorExists(doctorId: string) {
    const doctor = await this.prisma.doctorProfile.findUnique({ where: { id: doctorId } });
    if (!doctor) throw new NotFoundException('Doctor profile not found');
    return doctor;
  }

  private safeUserSelect() {
    return {
      id: true,
      username: true,
      email: true,
      role: true,
      status: true,
      firstLogin: true,
      createdAt: true,
      updatedAt: true,
    } as const;
  }
}

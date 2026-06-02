import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import {
  ClinicalRoomListFilter,
  ClinicalRoomRepositoryPort,
  CreateClinicalRoomData,
  UpdateClinicalRoomData,
} from '../../application/ports/clinical-room.repository.port';

/**
 * Prisma-backed ClinicalRoom repository. Preserves the include shapes and the
 * one-room-per-doctor reassignment transactions from the former ClinicalRoomService.
 */
@Injectable()
export class PrismaClinicalRoomRepository implements ClinicalRoomRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.clinicalRoom.findUnique({ where: { id }, select: { id: true } });
  }

  async findByRoomCode(roomCode: string) {
    return this.prisma.clinicalRoom.findUnique({ where: { roomCode: roomCode.trim() }, select: { id: true } });
  }

  async doctorExists(doctorId: string): Promise<boolean> {
    return Boolean(await this.prisma.doctorProfile.findUnique({ where: { id: doctorId }, select: { id: true } }));
  }

  async createWithDoctorReassign(data: CreateClinicalRoomData): Promise<any> {
    return this.prisma.$transaction(async (tx) => {
      if (data.doctorId) {
        await tx.clinicalRoom.updateMany({ where: { doctorId: data.doctorId }, data: { doctorId: null } });
      }

      return tx.clinicalRoom.create({
        data: {
          roomCode: data.roomCode.trim(),
          roomName: data.roomName.trim(),
          doctorId: data.doctorId || null,
          floor: data.floor?.trim(),
          description: data.description?.trim(),
          status: data.status,
        },
        include: this.includeRelations(),
      });
    });
  }

  async findManyPaginated(filter: ClinicalRoomListFilter, skip: number, take: number) {
    const where: Prisma.ClinicalRoomWhereInput = {
      ...(filter.roomCode ? { roomCode: { contains: filter.roomCode, mode: 'insensitive' } } : {}),
      ...(filter.roomName ? { roomName: { contains: filter.roomName, mode: 'insensitive' } } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.search
        ? {
          OR: [
            { roomCode: { contains: filter.search, mode: 'insensitive' } },
            { roomName: { contains: filter.search, mode: 'insensitive' } },
          ],
        }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.clinicalRoom.findMany({ where, include: this.includeRelations(), orderBy: { roomCode: 'asc' }, skip, take }),
      this.prisma.clinicalRoom.count({ where }),
    ]);
    return { items, total };
  }

  async updateWithDoctorReassign(id: string, data: UpdateClinicalRoomData): Promise<any> {
    return this.prisma.$transaction(async (tx) => {
      if (data.doctorId) {
        await tx.clinicalRoom.updateMany({ where: { doctorId: data.doctorId, id: { not: id } }, data: { doctorId: null } });
      }

      return tx.clinicalRoom.update({
        where: { id },
        data: {
          ...(data.roomCode !== undefined ? { roomCode: data.roomCode.trim() } : {}),
          ...(data.roomName !== undefined ? { roomName: data.roomName.trim() } : {}),
          ...(data.doctorId !== undefined ? { doctorId: data.doctorId || null } : {}),
          ...(data.floor !== undefined ? { floor: data.floor?.trim() } : {}),
          ...(data.description !== undefined ? { description: data.description?.trim() } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
        },
        include: this.includeRelations(),
      });
    });
  }

  async assignDoctor(id: string, doctorId?: string | null): Promise<any> {
    return this.prisma.$transaction(async (tx) => {
      if (doctorId) {
        await tx.clinicalRoom.updateMany({ where: { doctorId, id: { not: id } }, data: { doctorId: null } });
      }

      return tx.clinicalRoom.update({ where: { id }, data: { doctorId: doctorId || null }, include: this.includeRelations() });
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.clinicalRoom.delete({ where: { id } });
  }

  private includeRelations() {
    return { doctor: { include: { staffProfile: { include: { user: { select: this.safeUserSelect() }, department: true } } } } } as const;
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

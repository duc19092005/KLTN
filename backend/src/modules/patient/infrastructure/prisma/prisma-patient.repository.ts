import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import {
  PatientListFilter,
  PatientRepositoryPort,
  PatientWriteData,
} from '../../application/ports/patient.repository.port';

/**
 * Prisma-backed Patient repository. Preserves the include shapes (recent
 * visits), field mapping/normalization, and patient-code generation from the
 * former PatientService.
 */
@Injectable()
export class PrismaPatientRepository implements PatientRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findByIdWithRelations(id: string): Promise<any | null> {
    return this.prisma.patient.findUnique({ where: { id }, include: this.includeRelations() });
  }

  async generatePatientCode(): Promise<string> {
    const latest = await this.prisma.patient.findFirst({ where: { patientCode: { startsWith: 'BN-' } }, orderBy: { patientCode: 'desc' }, select: { patientCode: true } });
    const lastNumber = Number(latest?.patientCode?.replace('BN-', '') || '0');
    return `BN-${String(lastNumber + 1).padStart(4, '0')}`;
  }

  async create(data: PatientWriteData, patientCode: string): Promise<any> {
    return this.prisma.patient.create({
      data: this.toData(data, patientCode) as Prisma.PatientUncheckedCreateInput,
      include: this.includeRelations(),
    });
  }

  async findManyPaginated(filter: PatientListFilter, skip: number, take: number) {
    const where: Prisma.PatientWhereInput = {
      ...(filter.citizenId ? { citizenId: { contains: filter.citizenId, mode: 'insensitive' } } : {}),
      ...(filter.phone ? { phone: { contains: filter.phone, mode: 'insensitive' } } : {}),
      ...(filter.search ? { OR: [
        { fullName: { contains: filter.search, mode: 'insensitive' } },
        { citizenId: { contains: filter.search, mode: 'insensitive' } },
        { phone: { contains: filter.search, mode: 'insensitive' } },
        { patientCode: { contains: filter.search, mode: 'insensitive' } },
      ] } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.patient.findMany({ where, include: this.includeRelations(), orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.patient.count({ where }),
    ]);
    return { items, total };
  }

  async update(id: string, data: PatientWriteData): Promise<any> {
    return this.prisma.patient.update({
      where: { id },
      data: this.toData(data) as Prisma.PatientUncheckedUpdateInput,
      include: this.includeRelations(),
    });
  }

  private toData(dto: PatientWriteData, patientCode?: string): Record<string, unknown> {
    return {
      ...(patientCode ? { patientCode } : {}),
      ...(dto.fullName !== undefined ? { fullName: dto.fullName.trim() } : {}),
      ...(dto.gender !== undefined ? { gender: dto.gender.trim() } : {}),
      ...(dto.birthDate !== undefined ? { birthDate: new Date(dto.birthDate) } : {}),
      ...(dto.citizenId !== undefined ? { citizenId: dto.citizenId?.trim() || null } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
      ...(dto.address !== undefined ? { address: dto.address?.trim() || null } : {}),
      ...(dto.insuranceNumber !== undefined ? { insuranceNumber: dto.insuranceNumber?.trim() || null } : {}),
      ...(dto.emergencyContact !== undefined ? { emergencyContact: dto.emergencyContact?.trim() || null } : {}),
    };
  }

  private includeRelations() {
    return { visits: { orderBy: { checkInAt: 'desc' }, take: 10, include: { clinicalRoom: true, doctor: { include: { staffProfile: true } } } } } as const;
  }
}

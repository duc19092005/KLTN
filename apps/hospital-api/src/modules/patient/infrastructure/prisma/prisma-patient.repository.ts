import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import {
  PatientListFilter,
  PatientRepositoryPort,
  PatientWriteHook,
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

  async findByPatientCode(patientCode: string): Promise<any | null> {
    return this.prisma.patient.findUnique({
      where: { patientCode },
      include: {
        visits: {
          orderBy: { checkInAt: 'desc' as const },
          include: {
            department: true,
            staff: { include: { doctorProfile: true } },
            finalConclusion: {
              include: {
                aiDiagnosis: { include: { aiModel: true } },
                doctor: { include: { staffProfile: true } },
              },
            },
            aiDiagnoses: {
              include: { aiModel: true },
              orderBy: { createdAt: 'desc' as const },
            },
          },
        },
      },
    });
  }

  async findIdentityConflict(data: PatientWriteData, excludeId?: string) {
    const identityChecks: Prisma.PatientWhereInput[] = [];
    if (data.citizenId?.trim()) identityChecks.push({ citizenId: data.citizenId.trim() });
    if (data.insuranceNumber?.trim()) identityChecks.push({ insuranceNumber: data.insuranceNumber.trim() });
    if (data.phone?.trim() && data.birthDate && data.fullName?.trim()) {
      identityChecks.push({
        phone: data.phone.trim(),
        birthDate: new Date(data.birthDate),
        fullName: { equals: data.fullName.trim(), mode: 'insensitive' },
      });
    }
    if (identityChecks.length === 0) return null;
    return this.prisma.patient.findFirst({
      where: {
        ...(excludeId ? { id: { not: excludeId } } : {}),
        OR: identityChecks,
      },
      select: { id: true, patientCode: true },
    });
  }

  async generatePatientCode(): Promise<string> {
    const latest = await this.prisma.patient.findFirst({ where: { patientCode: { startsWith: 'BN-' } }, orderBy: { patientCode: 'desc' }, select: { patientCode: true } });
    const lastNumber = Number(latest?.patientCode?.replace('BN-', '') || '0');
    return `BN-${String(lastNumber + 1).padStart(4, '0')}`;
  }

  async create(data: PatientWriteData, patientCode: string, afterWrite?: PatientWriteHook): Promise<any> {
    return this.prisma.$transaction(async (tx) => {
      const patient = await tx.patient.create({
        data: this.toData(data, patientCode) as Prisma.PatientUncheckedCreateInput,
        include: this.includeRelations(),
      });
      await afterWrite?.(patient, tx);
      return patient;
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

  async update(id: string, data: PatientWriteData, afterWrite?: PatientWriteHook): Promise<any> {
    return this.prisma.$transaction(async (tx) => {
      const patient = await tx.patient.update({
        where: { id },
        data: this.toData(data) as Prisma.PatientUncheckedUpdateInput,
        include: this.includeRelations(),
      });
      await afterWrite?.(patient, tx);
      return patient;
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
    return {
      visits: {
        orderBy: { checkInAt: 'desc' },
        take: 10,
        include: { department: true, staff: { include: { doctorProfile: true } } },
      },
    } as const;
  }
}

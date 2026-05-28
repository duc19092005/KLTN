import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { getPagination, paginated } from '../../shared/pagination.dto';
import { CreatePatientDto, PatientQueryDto, UpdatePatientDto } from '../dto/patient.dto';

@Injectable()
export class PatientService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePatientDto) {
    const patientCode = dto.patientCode || await this.generatePatientCode();
    return this.prisma.patient.create({ data: this.toCreateData(dto, patientCode), include: this.includeRelations() });
  }

  async findAll(query: PatientQueryDto) {
    const { page, limit, skip } = getPagination(query);
    const where: Prisma.PatientWhereInput = {
      ...(query.citizenId ? { citizenId: { contains: query.citizenId, mode: 'insensitive' } } : {}),
      ...(query.phone ? { phone: { contains: query.phone, mode: 'insensitive' } } : {}),
      ...(query.search ? { OR: [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { citizenId: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
        { patientCode: { contains: query.search, mode: 'insensitive' } },
      ] } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.patient.findMany({ where, include: this.includeRelations(), orderBy: { createdAt: 'desc' }, skip, take: limit }),
      this.prisma.patient.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async findOne(id: string) {
    const patient = await this.prisma.patient.findUnique({ where: { id }, include: this.includeRelations() });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  async update(id: string, dto: UpdatePatientDto) {
    await this.findOne(id);
    return this.prisma.patient.update({ where: { id }, data: this.toUpdateData(dto), include: this.includeRelations() });
  }

  private toCreateData(dto: CreatePatientDto, patientCode: string): Prisma.PatientUncheckedCreateInput {
    return this.toData(dto, patientCode) as Prisma.PatientUncheckedCreateInput;
  }

  private toUpdateData(dto: UpdatePatientDto): Prisma.PatientUncheckedUpdateInput {
    return this.toData(dto) as Prisma.PatientUncheckedUpdateInput;
  }

  private toData(dto: CreatePatientDto | UpdatePatientDto, patientCode?: string): Record<string, unknown> {
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

  private async generatePatientCode() {
    const latest = await this.prisma.patient.findFirst({ where: { patientCode: { startsWith: 'BN-' } }, orderBy: { patientCode: 'desc' }, select: { patientCode: true } });
    const lastNumber = Number(latest?.patientCode?.replace('BN-', '') || '0');
    return `BN-${String(lastNumber + 1).padStart(4, '0')}`;
  }
}

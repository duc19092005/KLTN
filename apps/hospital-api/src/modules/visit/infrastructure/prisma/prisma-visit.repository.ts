import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, VisitStatus } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import {
  CreateVisitCommand,
  isUniqueVisitCodeConflict,
  VisitEntity,
  VisitListFilter,
  VisitCreatedHook,
  PatientCreatedHook,
  VisitUpdatedHook,
  VisitBeforeWriteHook,
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
      select: {
        id: true,
        visitCode: true,
        patientId: true,
        departmentId: true,
        staffId: true,
        status: true,
        source: true,
        checkInAt: true,
        completedAt: true,
        hash256: true,
        dataSalt: true,
      },
    });
  }

  async findDepartmentForVisit(departmentId: string) {
    return this.prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true, type: true, status: true },
    });
  }

  async findDoctorStaffByUserId(userId: string) {
    const doctor = await this.prisma.doctorProfile.findFirst({
      where: { staffProfile: { userId } },
      select: { id: true, staffProfile: { select: { id: true, departmentId: true } } },
    });
    if (!doctor) return null;
    return {
      doctorId: doctor.id,
      staffId: doctor.staffProfile.id,
      departmentId: doctor.staffProfile.departmentId,
    };
  }

  async createVisitWithOptionalPatient(
    command: CreateVisitCommand,
    onCreated?: VisitCreatedHook,
    onPatientCreated?: PatientCreatedHook,
    beforeWrite?: VisitBeforeWriteHook,
  ): Promise<unknown> {
    if (!command.patientId && command.patient) {
      const identityChecks: Prisma.PatientWhereInput[] = [];
      if (command.patient.citizenId?.trim()) identityChecks.push({ citizenId: command.patient.citizenId.trim() });
      if (command.patient.insuranceNumber?.trim()) identityChecks.push({ insuranceNumber: command.patient.insuranceNumber.trim() });
      if (command.patient.phone?.trim()) {
        identityChecks.push({
          phone: command.patient.phone.trim(),
          birthDate: new Date(command.patient.birthDate),
          fullName: { equals: command.patient.fullName.trim(), mode: 'insensitive' },
        });
      }
      const existingCitizen = identityChecks.length ? await this.prisma.patient.findFirst({
        where: { OR: identityChecks },
        select: { id: true, fullName: true, patientCode: true },
      }) : null;
      if (existingCitizen) {
        throw new BadRequestException(
          `Thông tin định danh đã tồn tại trong hệ thống (mã BN: ${existingCitizen.patientCode}, tên: ${existingCitizen.fullName}). Vui lòng chọn bệnh nhân có sẵn.`,
        );
      }
    }

    // Retry on unique-code collisions: patientCode/visitCode are generated from the
    // latest row, so concurrent intakes can collide. The whole transaction rolls back
    // and regenerates fresh codes on the next attempt.
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          await beforeWrite?.(tx);
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
            if (onPatientCreated) await onPatientCreated(patient, tx);
            patientId = patient.id;
          }
          if (!patientId) throw new BadRequestException('Vui lòng chọn bệnh nhân.');
          const visitCode = await this.generateVisitCode(tx);
          const visit = await tx.visit.create({
            data: {
              visitCode,
              patientId,
              departmentId: command.departmentId,
              staffId: command.staffId ?? null,
              status: VisitStatus.WAITING,
            },
            include: this.includeRelations(),
          });
          if (onCreated) await onCreated(visit, tx);
          return visit;
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
      ...(filter.staffId ? { staffId: filter.staffId } : {}),
      ...(filter.departmentId ? { departmentId: filter.departmentId } : {}),
      ...(filter.patientId ? { patientId: filter.patientId } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.visit.findMany({ where, include: this.includeRelations(), orderBy: { checkInAt: 'asc' }, skip, take }),
      this.prisma.visit.count({ where }),
    ]);
    return { items, total };
  }

  async updateStatus(
    id: string,
    status: VisitStatus,
    completedAt?: Date,
    staffId?: string,
    afterWrite?: VisitUpdatedHook,
    beforeWrite?: VisitBeforeWriteHook,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await beforeWrite?.(tx);
      const visit = await tx.visit.update({
        where: { id },
        data: { status, completedAt, ...(staffId ? { staffId } : {}) },
        include: this.includeRelations(),
      });
      await afterWrite?.(visit, tx);
      return visit;
    });
  }

  async suggestDepartments(specialty: string) {
    const where: Prisma.DepartmentWhereInput = {
      status: 'ACTIVE',
      type: 'EXAMINATION',
      ...(specialty ? { staffs: { some: { doctorProfile: { specialty: specialty as any }, user: { role: 'DOCTOR', status: 'ACTIVE' } } } } : {}),
    };
    return this.prisma.department.findMany({
      where,
      include: {
        staffs: {
          where: { user: { role: 'DOCTOR', status: 'ACTIVE' }, ...(specialty ? { doctorProfile: { specialty: specialty as any } } : {}) },
          include: { user: { select: this.safeUserSelect() }, doctorProfile: true },
        },
      },
      orderBy: { departmentCode: 'asc' },
      take: 10,
    });
  }

  private includeRelations() {
    return {
      patient: true,
      department: true,
      staff: {
        include: {
          department: true,
          doctorProfile: true,
          user: { select: this.safeUserSelect() },
        },
      },
    } as const;
  }

  private safeUserSelect() {
    return { id: true, username: true, email: true, role: true, status: true } as const;
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

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { CreateDoctorDto, CreateDoctorWithStaffDto, UpdateDoctorDto } from '../../dto/doctor.dto';
import {
  DoctorListFilter,
  DoctorRepositoryPort,
  StaffForDoctorCreate,
} from '../../application/ports/doctor.repository.port';

/**
 * Prisma-backed DoctorProfile repository. Preserves the include shapes, employee
 * code generation, and the multi-step transactions (createWithStaff, update with
 * clinical-room reassignment, assignRoom) from the former DoctorService.
 */
@Injectable()
export class PrismaDoctorRepository implements DoctorRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findByIdWithRelations(id: string): Promise<any | null> {
    return this.prisma.doctorProfile.findUnique({ where: { id }, include: this.includeRelations() });
  }

  async findStaffForDoctorCreate(staffProfileId: string): Promise<StaffForDoctorCreate | null> {
    const staff = await this.prisma.staffProfile.findUnique({
      where: { id: staffProfileId },
      include: { user: { select: { role: true } }, doctorProfile: true },
    });
    if (!staff) return null;
    return { id: staff.id, userRole: staff.user.role, hasDoctorProfile: Boolean(staff.doctorProfile) };
  }

  async departmentExists(id: string): Promise<boolean> {
    return Boolean(await this.prisma.department.findUnique({ where: { id }, select: { id: true } }));
  }

  async roomExists(id: string): Promise<boolean> {
    return Boolean(await this.prisma.clinicalRoom.findUnique({ where: { id }, select: { id: true } }));
  }

  async findDoctorByLicense(licenseNumber: string) {
    return this.prisma.doctorProfile.findUnique({ where: { licenseNumber: licenseNumber.trim() }, select: { id: true } });
  }

  async findStaffByCitizenId(citizenId: string) {
    return this.prisma.staffProfile.findUnique({ where: { citizenId: citizenId.trim() }, select: { id: true } });
  }

  async findUserByUsernameOrEmail(username: string, email: string) {
    return this.prisma.user.findFirst({
      where: { OR: [{ username: username.trim() }, { email: email.trim().toLowerCase() }] },
      select: { id: true },
    });
  }

  async findStaffByEmployeeCode(employeeCode: string) {
    return this.prisma.staffProfile.findUnique({ where: { employeeCode: employeeCode.trim() }, select: { id: true } });
  }

  async generateEmployeeCode(): Promise<string> {
    const prefix = 'BS';
    const latest = await this.prisma.staffProfile.findFirst({ where: { employeeCode: { startsWith: `${prefix}-` } }, orderBy: { employeeCode: 'desc' }, select: { employeeCode: true } });
    const lastNumber = Number(latest?.employeeCode?.replace(`${prefix}-`, '') || '0');
    return `${prefix}-${String(lastNumber + 1).padStart(4, '0')}`;
  }

  async createForExistingStaff(dto: CreateDoctorDto): Promise<any> {
    return this.prisma.doctorProfile.create({ data: this.toCreateData(dto), include: this.includeRelations() });
  }

  async createWithStaff(dto: CreateDoctorWithStaffDto, employeeCode: string, passwordHash: string): Promise<any> {
    return this.prisma.$transaction(async (tx) => {
      if (dto.clinicalRoomId) {
        await tx.clinicalRoom.updateMany({ where: { doctorId: { not: null }, id: dto.clinicalRoomId }, data: { doctorId: null } });
      }

      const user = await tx.user.create({
        data: {
          username: dto.username.trim(),
          email: dto.email.trim().toLowerCase(),
          passwordHash,
          role: UserRole.DOCTOR,
          status: UserStatus.ACTIVE,
          firstLogin: true,
          staffProfile: {
            create: {
              employeeCode,
              fullName: dto.fullName.trim(),
              phone: dto.phone.trim(),
              gender: dto.gender.trim(),
              citizenId: dto.citizenId.trim(),
              birthDate: new Date(dto.birthDate),
              address: dto.address?.trim(),
              avatarUrl: dto.avatarUrl.trim(),
              departmentId: dto.departmentId || null,
              position: dto.position?.trim(),
              doctorProfile: {
                create: this.toNestedCreateData(dto),
              },
            },
          },
        },
        include: { staffProfile: { include: { doctorProfile: true } } },
      });

      const doctorId = user.staffProfile?.doctorProfile?.id;
      if (!doctorId) throw new BadRequestException('Doctor profile was not created');

      if (dto.clinicalRoomId) {
        await tx.clinicalRoom.update({ where: { id: dto.clinicalRoomId }, data: { doctorId } });
      }

      return tx.doctorProfile.findUniqueOrThrow({ where: { id: doctorId }, include: this.includeRelations() });
    });
  }

  async findManyPaginated(filter: DoctorListFilter, skip: number, take: number) {
    const where: Prisma.DoctorProfileWhereInput = {
      ...(filter.specialty ? { specialty: { contains: filter.specialty, mode: 'insensitive' } } : {}),
      ...(filter.search ? { OR: [{ specialty: { contains: filter.search, mode: 'insensitive' } }, { licenseNumber: { contains: filter.search, mode: 'insensitive' } }, { staffProfile: { fullName: { contains: filter.search, mode: 'insensitive' } } }] } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.doctorProfile.findMany({ where, include: this.includeRelations(), orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.doctorProfile.count({ where }),
    ]);
    return { items, total };
  }

  async updateWithRoom(id: string, dto: UpdateDoctorDto): Promise<any> {
    return this.prisma.$transaction(async (tx) => {
      if (dto.clinicalRoomId !== undefined) {
        const targetRoomId = dto.clinicalRoomId || null;
        if (targetRoomId) {
          const room = await tx.clinicalRoom.findUnique({ where: { id: targetRoomId } });
          if (!room) throw new NotFoundException('Clinical room not found');
        }
        await tx.clinicalRoom.updateMany({ where: { doctorId: id }, data: { doctorId: null } });
        if (targetRoomId) {
          await tx.clinicalRoom.update({ where: { id: targetRoomId }, data: { doctorId: id } });
        }
      }

      const staffData: any = {};
      if (dto.fullName !== undefined) staffData.fullName = dto.fullName.trim();
      if (dto.phone !== undefined) staffData.phone = dto.phone.trim();
      if (dto.gender !== undefined) staffData.gender = dto.gender.trim();
      if (dto.citizenId !== undefined) staffData.citizenId = dto.citizenId.trim();
      if (dto.birthDate !== undefined) staffData.birthDate = new Date(dto.birthDate);
      if (dto.address !== undefined) staffData.address = dto.address.trim() || null;
      if (dto.avatarUrl !== undefined) staffData.avatarUrl = dto.avatarUrl.trim();
      if (dto.departmentId !== undefined) staffData.departmentId = dto.departmentId || null;
      if (dto.position !== undefined) staffData.position = dto.position.trim() || null;

      const hasStaffUpdates = Object.keys(staffData).length > 0;

      return tx.doctorProfile.update({
        where: { id },
        data: {
          ...(dto.specialty !== undefined ? { specialty: dto.specialty.trim() } : {}),
          ...(dto.licenseNumber !== undefined ? { licenseNumber: dto.licenseNumber.trim() } : {}),
          ...(dto.qualification !== undefined ? { qualification: dto.qualification.trim() } : {}),
          ...(dto.yearsExperience !== undefined ? { yearsExperience: Number(dto.yearsExperience) } : {}),
          ...(hasStaffUpdates ? { staffProfile: { update: staffData } } : {}),
        },
        include: this.includeRelations(),
      });
    });
  }

  async assignRoom(id: string, clinicalRoomId?: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      if (clinicalRoomId) {
        const room = await tx.clinicalRoom.findUnique({ where: { id: clinicalRoomId } });
        if (!room) throw new NotFoundException('Clinical room not found');
      }

      await tx.clinicalRoom.updateMany({ where: { doctorId: id }, data: { doctorId: null } });

      if (clinicalRoomId) {
        await tx.clinicalRoom.update({ where: { id: clinicalRoomId }, data: { doctorId: id } });
      }
    });
  }

  async findByStaffProfileId(staffProfileId: string): Promise<any | null> {
    return this.prisma.doctorProfile.findUnique({ where: { staffProfileId }, include: this.includeRelations() });
  }

  async findAllWithRelations(): Promise<any[]> {
    return this.prisma.doctorProfile.findMany({ include: this.includeRelations(), orderBy: { createdAt: 'desc' } });
  }

  private toCreateData(dto: CreateDoctorDto): Prisma.DoctorProfileUncheckedCreateInput {
    return { staffProfileId: dto.staffProfileId, specialty: dto.specialty.trim(), licenseNumber: dto.licenseNumber.trim(), qualification: dto.qualification.trim(), yearsExperience: dto.yearsExperience === undefined ? null : Number(dto.yearsExperience) };
  }

  private toNestedCreateData(dto: Pick<CreateDoctorWithStaffDto, 'specialty' | 'licenseNumber' | 'qualification' | 'yearsExperience'>): Prisma.DoctorProfileCreateWithoutStaffProfileInput {
    return { specialty: dto.specialty.trim(), licenseNumber: dto.licenseNumber.trim(), qualification: dto.qualification.trim(), yearsExperience: dto.yearsExperience === undefined ? null : Number(dto.yearsExperience) };
  }

  private includeRelations() {
    return { staffProfile: { include: { user: { select: this.safeUserSelect() }, department: true } }, clinicalRoom: true } as const;
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

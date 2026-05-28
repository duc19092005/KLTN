import * as bcrypt from 'bcrypt';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { getPagination, paginated } from '../../shared/pagination.dto';
import { AssignClinicalRoomDto, CreateDoctorDto, CreateDoctorWithStaffDto, DoctorQueryDto, UpdateDoctorDto } from '../dto/doctor.dto';

const DEFAULT_STAFF_PASSWORD = '123456';

@Injectable()
export class DoctorService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDoctorDto) {
    const staff = await this.prisma.staffProfile.findUnique({
      where: { id: dto.staffProfileId },
      include: { user: { select: this.safeUserSelect() }, doctorProfile: true },
    });
    if (!staff) throw new NotFoundException('Staff profile not found');
    if (staff.user.role !== UserRole.DOCTOR) throw new BadRequestException('Staff user role must be DOCTOR');
    if (staff.doctorProfile) throw new ConflictException('Doctor profile already exists for this staff');
    await this.assertLicenseUnique(dto.licenseNumber);
    return this.prisma.doctorProfile.create({ data: this.toCreateData(dto), include: this.includeRelations() });
  }

  async createWithStaff(dto: CreateDoctorWithStaffDto) {
    if (dto.departmentId) await this.ensureDepartment(dto.departmentId);
    if (dto.clinicalRoomId) await this.ensureRoom(dto.clinicalRoomId);
    await this.assertUserUnique(dto.username, dto.email);
    await this.assertCitizenIdUnique(dto.citizenId);
    await this.assertLicenseUnique(dto.licenseNumber);

    const employeeCode = await this.generateEmployeeCode(UserRole.DOCTOR);
    await this.assertEmployeeCodeUnique(employeeCode);
    const passwordHash = await bcrypt.hash(DEFAULT_STAFF_PASSWORD, 12);

    try {
      const doctor = await this.prisma.$transaction(async (tx) => {
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

      return doctor;
    } catch (error) {
      this.rethrowUniqueConstraint(error);
      throw error;
    }
  }

  async findAll(query: DoctorQueryDto) {
    const { page, limit, skip } = getPagination(query);
    const where: Prisma.DoctorProfileWhereInput = {
      ...(query.specialty ? { specialty: { contains: query.specialty, mode: 'insensitive' } } : {}),
      ...(query.search ? { OR: [{ specialty: { contains: query.search, mode: 'insensitive' } }, { licenseNumber: { contains: query.search, mode: 'insensitive' } }, { staffProfile: { fullName: { contains: query.search, mode: 'insensitive' } } }] } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.doctorProfile.findMany({ where, include: this.includeRelations(), orderBy: { createdAt: 'desc' }, skip, take: limit }),
      this.prisma.doctorProfile.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async update(id: string, dto: UpdateDoctorDto) {
    await this.ensureDoctor(id);
    if (dto.licenseNumber) await this.assertLicenseUnique(dto.licenseNumber, id);
    return this.prisma.doctorProfile.update({
      where: { id },
      data: {
        ...(dto.specialty !== undefined ? { specialty: dto.specialty.trim() } : {}),
        ...(dto.licenseNumber !== undefined ? { licenseNumber: dto.licenseNumber.trim() } : {}),
        ...(dto.qualification !== undefined ? { qualification: dto.qualification.trim() } : {}),
        ...(dto.yearsExperience !== undefined ? { yearsExperience: Number(dto.yearsExperience) } : {}),
      },
      include: this.includeRelations(),
    });
  }

  async assignRoom(id: string, dto: AssignClinicalRoomDto) {
    await this.ensureDoctor(id);

    await this.prisma.$transaction(async (tx) => {
      if (dto.clinicalRoomId) {
        const room = await tx.clinicalRoom.findUnique({ where: { id: dto.clinicalRoomId } });
        if (!room) throw new NotFoundException('Clinical room not found');
      }

      await tx.clinicalRoom.updateMany({ where: { doctorId: id }, data: { doctorId: null } });

      if (dto.clinicalRoomId) {
        await tx.clinicalRoom.update({ where: { id: dto.clinicalRoomId }, data: { doctorId: id } });
      }
    });

    return this.ensureDoctor(id);
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

  private async ensureDoctor(id: string) {
    const doctor = await this.prisma.doctorProfile.findUnique({ where: { id }, include: this.includeRelations() });
    if (!doctor) throw new NotFoundException('Doctor profile not found');
    return doctor;
  }

  private async ensureDepartment(id: string) {
    const department = await this.prisma.department.findUnique({ where: { id } });
    if (!department) throw new NotFoundException('Department not found');
    return department;
  }

  private async ensureRoom(id: string) {
    const room = await this.prisma.clinicalRoom.findUnique({ where: { id } });
    if (!room) throw new NotFoundException('Clinical room not found');
    return room;
  }

  private async assertLicenseUnique(licenseNumber: string, excludeId?: string) {
    const existing = await this.prisma.doctorProfile.findUnique({ where: { licenseNumber: licenseNumber.trim() } });
    if (existing && existing.id !== excludeId) throw new ConflictException('License number already exists');
  }

  private async assertUserUnique(username: string, email: string) {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: username.trim() },
          { email: email.trim().toLowerCase() },
        ],
      },
    });
    if (existing) throw new ConflictException('Username or email already exists');
  }

  private async assertCitizenIdUnique(citizenId: string) {
    const existing = await this.prisma.staffProfile.findUnique({ where: { citizenId: citizenId.trim() } });
    if (existing) throw new ConflictException('Citizen ID already exists');
  }

  private async generateEmployeeCode(role: UserRole) {
    const prefix = role === UserRole.DOCTOR ? 'BS' : 'NV';
    const latest = await this.prisma.staffProfile.findFirst({ where: { employeeCode: { startsWith: `${prefix}-` } }, orderBy: { employeeCode: 'desc' }, select: { employeeCode: true } });
    const lastNumber = Number(latest?.employeeCode?.replace(`${prefix}-`, '') || '0');
    return `${prefix}-${String(lastNumber + 1).padStart(4, '0')}`;
  }

  private async assertEmployeeCodeUnique(employeeCode: string) {
    const existing = await this.prisma.staffProfile.findUnique({ where: { employeeCode: employeeCode.trim() } });
    if (existing) throw new ConflictException('Employee code already exists');
  }

  private rethrowUniqueConstraint(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('Unique constraint violation while saving doctor');
    }
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

import * as bcrypt from 'bcrypt';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { BlockchainService } from '../../../infrastructure/blockchain/blockchain.service';
import { AuditLoggerService, AuditAction } from '../../../infrastructure/audit/audit-logger.service';
import { hashToBytes32 } from '../../../infrastructure/audit/audit-hash.util';
import { getPagination, paginated } from '../../shared/pagination.dto';
import { AssignClinicalRoomDto, CreateDoctorDto, CreateDoctorWithStaffDto, DoctorQueryDto, UpdateDoctorDto } from '../dto/doctor.dto';

const DEFAULT_STAFF_PASSWORD = '123456';

@Injectable()
export class DoctorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchain: BlockchainService,
    private readonly audit: AuditLoggerService,
  ) { }

  async create(dto: CreateDoctorDto) {
    const staff = await this.prisma.staffProfile.findUnique({
      where: { id: dto.staffProfileId },
      include: { user: { select: this.safeUserSelect() }, doctorProfile: true },
    });
    if (!staff) throw new NotFoundException('Staff profile not found');
    if (staff.user.role !== UserRole.DOCTOR) throw new BadRequestException('Staff user role must be DOCTOR');
    if (staff.doctorProfile) throw new ConflictException('Doctor profile already exists for this staff');
    await this.assertLicenseUnique(dto.licenseNumber);
    const doctor = await this.prisma.doctorProfile.create({ data: this.toCreateData(dto), include: this.includeRelations() });

    await this.anchorDoctorChange(doctor, 'CREATE', undefined, null);
    return doctor;
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

      // Single unified anchor: staff + doctor data hashed together under doctor.id
      await this.anchorDoctorChange(doctor, 'CREATE', undefined, null);
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

  async findOne(id: string) {
    const doctor = await this.ensureDoctor(id);
    const integrity = await this.evaluateIntegrity(doctor);
    return {
      ...doctor,
      audit: {
        status: integrity.status,
        dbMatches: integrity.dbMatches,
        chainMatches: integrity.chainMatches,
        onChainHash: integrity.onChainHash,
        storedHash: integrity.storedHash,
        recomputedHash: integrity.recomputedHash,
      },
    };
  }



  async update(id: string, dto: UpdateDoctorDto, actorId?: string) {
    const existing = await this.ensureDoctor(id);
    if (dto.licenseNumber) await this.assertLicenseUnique(dto.licenseNumber, id);
    if (dto.citizenId) {
      const existingStaff = await this.prisma.staffProfile.findUnique({
        where: { citizenId: dto.citizenId.trim() },
      });
      if (existingStaff && existingStaff.id !== existing.staffProfileId) {
        throw new ConflictException('Citizen ID already exists');
      }
    }
    if (dto.departmentId) await this.ensureDepartment(dto.departmentId);

    const before = this.buildUnifiedSnapshot(existing);

    const doctor = await this.prisma.$transaction(async (tx) => {
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

    await this.anchorDoctorChange(doctor, 'UPDATE', actorId, before);
    return doctor;
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

  // ---- Tamper-evidence helpers ------------------------------------------------

  /**
   * Unified snapshot: combines both staff identity fields and doctor professional fields
   * into a single object for hashing. This ensures one hash covers the entire doctor record.
   */
  private buildUnifiedSnapshot(doctor: any) {
    const staff = doctor.staffProfile || {};
    return {
      // Staff identity fields
      employeeCode: staff.employeeCode ?? null,
      fullName: staff.fullName ?? null,
      phone: staff.phone ?? null,
      gender: staff.gender ?? null,
      citizenId: staff.citizenId ?? null,
      birthDate: staff.birthDate instanceof Date ? staff.birthDate.toISOString() : (staff.birthDate ?? null),
      address: staff.address ?? null,
      avatarUrl: staff.avatarUrl ?? null,
      departmentId: staff.departmentId ?? null,
      position: staff.position ?? null,
      // Doctor professional fields
      staffProfileId: doctor.staffProfileId,
      specialty: doctor.specialty,
      licenseNumber: doctor.licenseNumber,
      qualification: doctor.qualification,
      yearsExperience: doctor.yearsExperience ?? null,
    };
  }

  /**
   * Compute the unified integrity hash (staff + doctor), mirror on-chain (StaffRegistry),
   * persist hash256/dataSalt on the DoctorProfile row, and write a BlockchainLogger entry.
   */
  private async anchorDoctorChange(doctor: any, action: AuditAction, actorId?: string, before?: unknown) {
    const snapshot = this.buildUnifiedSnapshot(doctor);
    let dataHash: string | null = null;
    let dataSalt: string | null = null;
    let onChainStatus = 'PENDING';
    let txHash: string | null = null;
    let blockNumber: number | null = null;

    try {
      if (action === 'DELETE') {
        const res = await this.blockchain.removeStaffHash(doctor.id);
        onChainStatus = res.success ? 'ANCHORED' : 'UNANCHORED';
        txHash = (res as any).txHash ?? null;
        blockNumber = (res as any).blockNumber ?? null;
      } else {
        const { salt, hash } = this.audit.hashSnapshot(snapshot);
        dataHash = hash;
        dataSalt = salt;
        await this.prisma.doctorProfile.update({ where: { id: doctor.id }, data: { hash256: hash, dataSalt: salt } });
        const res = await this.blockchain.setStaffHash(doctor.id, hashToBytes32(hash));
        onChainStatus = res.success ? 'ANCHORED' : 'UNANCHORED';
        txHash = (res as any).txHash ?? null;
        blockNumber = (res as any).blockNumber ?? null;
      }
    } catch (err) {
      console.error('Error anchoring doctor change:', err);
      onChainStatus = 'UNANCHORED';
    }

    await this.audit.record({
      entity: 'DoctorProfile',
      entityId: doctor.id,
      action,
      actorId,
      dataHash,
      dataSalt,
      before: before ?? null,
      after: action === 'DELETE' ? null : snapshot,
      onChainStatus,
      txHash,
      blockNumber,
    });
  }

  /**
   * Re-anchor the doctor hash when the staff profile is updated from StaffService.
   * Called by StaffService when updating a staff member who is also a doctor.
   */
  async reanchorForStaffUpdate(staffProfileId: string, actorId?: string) {
    const doctor = await this.prisma.doctorProfile.findUnique({
      where: { staffProfileId },
      include: this.includeRelations(),
    });
    if (!doctor) return; // Not a doctor, nothing to re-anchor

    const before = this.buildUnifiedSnapshot(doctor);
    // Re-fetch after staff update to get latest staff data
    const refreshed = await this.prisma.doctorProfile.findUniqueOrThrow({
      where: { id: doctor.id },
      include: this.includeRelations(),
    });
    await this.anchorDoctorChange(refreshed, 'UPDATE', actorId, before);
  }

  /** Change history for a doctor profile. */
  getHistory(id?: string) {
    return this.audit.history('DoctorProfile', id);
  }

  /** Verify a doctor profile's integrity against on-chain hash. */
  async verifyDoctor(id: string) {
    const doctor = await this.prisma.doctorProfile.findUnique({
      where: { id },
      include: this.includeRelations(),
    });
    if (!doctor) throw new NotFoundException('Doctor profile not found');
    return this.evaluateIntegrity(doctor);
  }

  /** Verify all doctor profiles. */
  async verifyAll() {
    const doctors = await this.prisma.doctorProfile.findMany({
      include: this.includeRelations(),
      orderBy: { createdAt: 'desc' },
    });
    const items = await Promise.all(doctors.map((d) => this.evaluateIntegrity(d)));
    const summary = items.reduce(
      (acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    return { total: items.length, summary, items };
  }

  /**
   * Unified integrity evaluation: one hash covering staff + doctor data.
   */
  private async evaluateIntegrity(doctor: any) {
    const snapshot = this.buildUnifiedSnapshot(doctor);
    const recomputed = doctor.dataSalt ? this.audit.recompute(snapshot, doctor.dataSalt) : null;
    const dbHash = doctor.hash256 || null;
    const onChain = await this.blockchain.getStaffHash(doctor.id);
    const onChainNormalized = onChain ? onChain.toLowerCase() : null;
    const recomputedBytes32 = recomputed ? hashToBytes32(recomputed).toLowerCase() : null;

    const dbMatches = recomputed !== null && recomputed === dbHash;
    const chainMatches = recomputedBytes32 !== null && recomputedBytes32 === onChainNormalized;

    let status: 'VERIFIED' | 'TAMPERED' | 'UNANCHORED';
    if (!onChainNormalized) status = 'UNANCHORED';
    else if (chainMatches) status = 'VERIFIED';
    else status = 'TAMPERED';

    return {
      id: doctor.id,
      staffProfileId: doctor.staffProfileId,
      specialty: doctor.specialty,
      licenseNumber: doctor.licenseNumber,
      status,
      dbMatches,
      chainMatches,
      recomputedHash: recomputed,
      storedHash: dbHash,
      onChainHash: onChain,
    };
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

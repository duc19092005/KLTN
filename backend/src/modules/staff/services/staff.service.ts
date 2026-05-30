import * as bcrypt from 'bcrypt';
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { BlockchainService } from '../../../infrastructure/blockchain/blockchain.service';
import { AuditLoggerService, AuditAction } from '../../../infrastructure/audit/audit-logger.service';
import { hashToBytes32 } from '../../../infrastructure/audit/audit-hash.util';
import { getPagination, paginated } from '../../shared/pagination.dto';
import { CreateStaffDto, StaffQueryDto, UpdateStaffDto } from '../dto/staff.dto';
import { DoctorService } from '../../doctor/services/doctor.service';

const DEFAULT_STAFF_PASSWORD = '123456';

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchain: BlockchainService,
    private readonly audit: AuditLoggerService,
    @Inject(forwardRef(() => DoctorService))
    private readonly doctorService: DoctorService,
  ) {}

  async create(dto: CreateStaffDto, actorId?: string) {
    if (dto.role === UserRole.ADMIN) {
      throw new BadRequestException('Staff module cannot create ADMIN users');
    }
    if (dto.role === UserRole.DOCTOR) {
      throw new BadRequestException('Use doctor module to create doctors with professional profile');
    }
    if (dto.departmentId) await this.ensureDepartment(dto.departmentId);
    await this.assertUserUnique(dto.username, dto.email);
    await this.assertCitizenIdUnique(dto.citizenId);
    const employeeCode = dto.employeeCode || (await this.generateEmployeeCode(dto.role));
    await this.assertEmployeeCodeUnique(employeeCode);
    const passwordHash = await this.hashPassword(DEFAULT_STAFF_PASSWORD);

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        return tx.user.create({
          data: {
            username: dto.username.trim(),
            email: dto.email.trim().toLowerCase(),
            passwordHash,
            role: dto.role,
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
              },
            },
          },
          include: this.includeUserStaff(),
        });
      });

      // Anchor the staff profile on-chain (non-doctor staff only)
      if (user.staffProfile) {
        await this.anchorStaffChange(user.staffProfile, 'CREATE', actorId, null);
      }

      return this.sanitizeUser(user);
    } catch (error) {
      this.rethrowUniqueConstraint(error);
      throw error;
    }
  }

  async findAll(query: StaffQueryDto) {
    const { page, limit, skip } = getPagination(query);
    const where: Prisma.StaffProfileWhereInput = {
      ...(query.employeeCode ? { employeeCode: { contains: query.employeeCode, mode: 'insensitive' } } : {}),
      ...(query.fullName ? { fullName: { contains: query.fullName, mode: 'insensitive' } } : {}),
      ...(query.citizenId ? { citizenId: { contains: query.citizenId, mode: 'insensitive' } } : {}),
      ...(query.department ? { department: { name: { contains: query.department, mode: 'insensitive' } } } : {}),
      ...(query.role ? { user: { role: query.role } } : {}),
      ...(query.search
        ? {
            OR: [
              { employeeCode: { contains: query.search, mode: 'insensitive' } },
              { fullName: { contains: query.search, mode: 'insensitive' } },
              { citizenId: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.staffProfile.findMany({ where, include: this.includeStaff(), orderBy: { createdAt: 'desc' }, skip, take: limit }),
      this.prisma.staffProfile.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async findOne(id: string) {
    const staff = await this.prisma.staffProfile.findUnique({
      where: { id },
      include: this.includeStaff(),
    });
    if (!staff) throw new NotFoundException('Staff profile not found');
    const integrity = await this.evaluateIntegrity(staff);
    return {
      ...staff,
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


  async update(id: string, dto: UpdateStaffDto, actorId?: string) {
    const staff = await this.ensureStaff(id);
    if (dto.departmentId) await this.ensureDepartment(dto.departmentId);
    if (dto.role === UserRole.ADMIN) {
      throw new BadRequestException('Staff module cannot promote users to ADMIN');
    }
    if (dto.role === UserRole.DOCTOR && staff.user.role !== UserRole.DOCTOR) {
      throw new BadRequestException('Use doctor module to create or promote doctors with professional profile');
    }
    if (staff.doctorProfile && dto.role && dto.role !== UserRole.DOCTOR) {
      throw new BadRequestException('Cannot change doctor role while DoctorProfile exists');
    }
    if (dto.username || dto.email) await this.assertUserUnique(dto.username, dto.email, staff.userId);
    if (dto.citizenId) await this.assertCitizenIdUnique(dto.citizenId, staff.id);

    const before = this.buildSnapshot(staff);
    const isDoctor = Boolean(staff.doctorProfile);

    try {
      const updated = await this.prisma.user.update({
        where: { id: staff.userId },
        data: {
          ...(dto.username !== undefined ? { username: dto.username.trim() } : {}),
          ...(dto.email !== undefined ? { email: dto.email.trim().toLowerCase() } : {}),
          ...(dto.role !== undefined ? { role: dto.role } : {}),
          ...(dto.status !== undefined ? { status: dto.status, tokenVersion: { increment: 1 } } : {}),
          staffProfile: {
            update: {
              ...(dto.fullName !== undefined ? { fullName: dto.fullName.trim() } : {}),
              ...(dto.phone !== undefined ? { phone: dto.phone.trim() } : {}),
              ...(dto.gender !== undefined ? { gender: dto.gender.trim() } : {}),
              ...(dto.citizenId !== undefined ? { citizenId: dto.citizenId.trim() } : {}),
              ...(dto.birthDate !== undefined ? { birthDate: new Date(dto.birthDate) } : {}),
              ...(dto.address !== undefined ? { address: dto.address?.trim() } : {}),
              ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl.trim() } : {}),
              ...(dto.departmentId !== undefined ? { departmentId: dto.departmentId || null } : {}),
              ...(dto.position !== undefined ? { position: dto.position?.trim() } : {}),
            },
          },
        },
        include: this.includeUserStaff(),
      });

      if (isDoctor) {
        // Staff is a doctor → re-anchor the unified doctor hash (staff + doctor)
        await this.doctorService.reanchorForStaffUpdate(id, actorId);
      } else if (updated.staffProfile) {
        // Regular staff → anchor just the staff profile
        await this.anchorStaffChange(updated.staffProfile, 'UPDATE', actorId, before);
      }

      return this.sanitizeUser(updated);
    } catch (error) {
      this.rethrowUniqueConstraint(error);
      throw error;
    }
  }

  async setStatus(id: string, status: UserStatus, actorId?: string) {
    const staff = await this.ensureStaff(id);
    const before = this.buildSnapshot(staff);
    const isDoctor = Boolean(staff.doctorProfile);
    const updated = await this.prisma.user.update({ where: { id: staff.userId }, data: { status, tokenVersion: { increment: 1 } }, include: this.includeUserStaff() });

    if (isDoctor) {
      // Staff is a doctor → re-anchor the unified doctor hash
      await this.doctorService.reanchorForStaffUpdate(id, actorId);
    } else if (updated.staffProfile) {
      // Anchor the status change for regular staff
      const action: AuditAction = status === UserStatus.INACTIVE ? 'DELETE' : 'UPDATE';
      await this.anchorStaffChange(updated.staffProfile, action, actorId, before);
    }

    return this.sanitizeUser(updated);
  }

  async remove(id: string, actorId?: string) {
    return this.setStatus(id, UserStatus.INACTIVE, actorId);
  }

  // ---- Tamper-evidence helpers ------------------------------------------------

  /** Business fields included in the integrity hash. */
  private buildSnapshot(staff: any) {
    return {
      employeeCode: staff.employeeCode,
      fullName: staff.fullName,
      phone: staff.phone,
      gender: staff.gender,
      citizenId: staff.citizenId,
      birthDate: staff.birthDate instanceof Date ? staff.birthDate.toISOString() : staff.birthDate,
      address: staff.address ?? null,
      avatarUrl: staff.avatarUrl,
      departmentId: staff.departmentId ?? null,
      position: staff.position ?? null,
    };
  }

  /**
   * Compute the integrity hash, mirror on-chain (StaffRegistry),
   * persist hash256/dataSalt on the row, and write a BlockchainLogger entry.
   * Only used for non-doctor staff (Receptionist, Lab Manager, etc.).
   */
  private async anchorStaffChange(staffProfile: any, action: AuditAction, actorId?: string, before?: unknown) {
    const snapshot = this.buildSnapshot(staffProfile);
    let dataHash: string | null = null;
    let dataSalt: string | null = null;
    let onChainStatus = 'PENDING';
    let txHash: string | null = null;
    let blockNumber: number | null = null;

    try {
      if (action === 'DELETE') {
        const res = await this.blockchain.removeStaffHash(staffProfile.id);
        onChainStatus = res.success ? 'ANCHORED' : 'UNANCHORED';
        txHash = (res as any).txHash ?? null;
        blockNumber = (res as any).blockNumber ?? null;
      } else {
        const { salt, hash } = this.audit.hashSnapshot(snapshot);
        dataHash = hash;
        dataSalt = salt;
        await this.prisma.staffProfile.update({ where: { id: staffProfile.id }, data: { hash256: hash, dataSalt: salt } });
        const res = await this.blockchain.setStaffHash(staffProfile.id, hashToBytes32(hash));
        onChainStatus = res.success ? 'ANCHORED' : 'UNANCHORED';
        txHash = (res as any).txHash ?? null;
        blockNumber = (res as any).blockNumber ?? null;
      }
    } catch {
      onChainStatus = 'UNANCHORED';
    }

    await this.audit.record({
      entity: 'StaffProfile',
      entityId: staffProfile.id,
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

  /** Change history for a staff profile. */
  getHistory(id?: string) {
    return this.audit.history('StaffProfile', id);
  }

  /** Verify a staff profile's integrity against on-chain hash. */
  async verifyStaff(id: string) {
    const staff = await this.prisma.staffProfile.findUnique({ where: { id } });
    if (!staff) throw new NotFoundException('Staff profile not found');
    return this.evaluateIntegrity(staff);
  }

  /** Verify all staff profiles. */
  async verifyAll() {
    const staffs = await this.prisma.staffProfile.findMany({ orderBy: { employeeCode: 'asc' } });
    const items = await Promise.all(staffs.map((s) => this.evaluateIntegrity(s)));
    const summary = items.reduce(
      (acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    return { total: items.length, summary, items };
  }

  private async evaluateIntegrity(staff: any) {
    const snapshot = this.buildSnapshot(staff);
    const recomputed = staff.dataSalt ? this.audit.recompute(snapshot, staff.dataSalt) : null;
    const dbHash = staff.hash256 || null;
    const onChain = await this.blockchain.getStaffHash(staff.id);
    const onChainNormalized = onChain ? onChain.toLowerCase() : null;
    const recomputedBytes32 = recomputed ? hashToBytes32(recomputed).toLowerCase() : null;

    const dbMatches = recomputed !== null && recomputed === dbHash;
    const chainMatches = recomputedBytes32 !== null && recomputedBytes32 === onChainNormalized;

    let status: 'VERIFIED' | 'TAMPERED' | 'UNANCHORED';
    if (!onChainNormalized) status = 'UNANCHORED';
    else if (chainMatches) status = 'VERIFIED';
    else status = 'TAMPERED';

    return {
      id: staff.id,
      employeeCode: staff.employeeCode,
      fullName: staff.fullName,
      status,
      dbMatches,
      chainMatches,
      recomputedHash: recomputed,
      storedHash: dbHash,
      onChainHash: onChain,
    };
  }

  private async generateEmployeeCode(role: UserRole) {
    const prefix = role === UserRole.DOCTOR ? 'BS' : 'NV';
    const latest = await this.prisma.staffProfile.findFirst({ where: { employeeCode: { startsWith: `${prefix}-` } }, orderBy: { employeeCode: 'desc' }, select: { employeeCode: true } });
    const lastNumber = Number(latest?.employeeCode?.replace(`${prefix}-`, '') || '0');
    return `${prefix}-${String(lastNumber + 1).padStart(4, '0')}`;
  }

  private hashPassword(password: string) {
    return bcrypt.hash(password, 12);
  }

  private async ensureDepartment(id: string) {
    const department = await this.prisma.department.findUnique({ where: { id } });
    if (!department) throw new NotFoundException('Department not found');
    return department;
  }

  private async ensureStaff(id: string) {
    const staff = await this.prisma.staffProfile.findUnique({ where: { id }, include: { user: true, doctorProfile: true } });
    if (!staff) throw new NotFoundException('Staff profile not found');
    return staff;
  }

  private includeStaff() {
    return { user: { select: this.safeUserSelect() }, department: true, doctorProfile: true, managedDepartment: true } as const;
  }

  private includeUserStaff() {
    return { staffProfile: { include: { department: true, doctorProfile: true, managedDepartment: true } } } as const;
  }

  private sanitizeUser<T extends { passwordHash?: string | null }>(user: T) {
    const { passwordHash, ...safe } = user;
    return safe;
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

  private async assertUserUnique(username?: string, email?: string, excludeUserId?: string) {
    const checks: Prisma.UserWhereInput[] = [];
    if (username) checks.push({ username: username.trim() });
    if (email) checks.push({ email: email.trim().toLowerCase() });
    if (checks.length === 0) return;

    const existing = await this.prisma.user.findFirst({ where: { OR: checks } });
    if (existing && existing.id !== excludeUserId) {
      throw new ConflictException('Username or email already exists');
    }
  }

  private async assertCitizenIdUnique(citizenId: string, excludeStaffId?: string) {
    const existing = await this.prisma.staffProfile.findUnique({ where: { citizenId: citizenId.trim() } });
    if (existing && existing.id !== excludeStaffId) {
      throw new ConflictException('Citizen ID already exists');
    }
  }

  private async assertEmployeeCodeUnique(employeeCode: string) {
    const existing = await this.prisma.staffProfile.findUnique({ where: { employeeCode: employeeCode.trim() } });
    if (existing) throw new ConflictException('Employee code already exists');
  }

  private rethrowUniqueConstraint(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('Unique constraint violation while saving staff');
    }
  }
}

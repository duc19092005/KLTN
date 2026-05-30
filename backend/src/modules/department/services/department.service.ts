import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OperationalStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { BlockchainService } from '../../../infrastructure/blockchain/blockchain.service';
import { AuditLoggerService, AuditAction } from '../../../infrastructure/audit/audit-logger.service';
import { hashToBytes32 } from '../../../infrastructure/audit/audit-hash.util';
import { AssignManagerDto, CreateDepartmentDto, DepartmentQueryDto, UpdateDepartmentDto } from '../dto/department.dto';
import { getPagination, paginated } from '../../shared/pagination.dto';

@Injectable()
export class DepartmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchain: BlockchainService,
    private readonly audit: AuditLoggerService,
  ) {}

  async create(dto: CreateDepartmentDto, actorId?: string) {
    await this.assertNameUnique(dto.name);
    await this.assertDepartmentCodeUnique(dto.departmentCode);
    if (dto.managerId) {
      const manager = await this.assertStaffExists(dto.managerId);
      await this.assertManagerAvailable(dto.managerId);
      if (manager.departmentId) {
        throw new BadRequestException('Manager is already assigned to another department');
      }
    }

    const department = await this.prisma.$transaction(async (tx) => {
      const created = await tx.department.create({
        data: {
          departmentCode: dto.departmentCode.trim(),
          name: dto.name.trim(),
          floor: dto.floor?.trim(),
          status: dto.status || OperationalStatus.ACTIVE,
          type: dto.type,
          canReceiveOrders: dto.canReceiveOrders ?? false,
          description: dto.description?.trim(),
          managerId: dto.managerId || null,
        },
        include: this.includeRelations(),
      });

      if (dto.managerId) {
        await tx.staffProfile.update({ where: { id: dto.managerId }, data: { departmentId: created.id } });
      }

      return tx.department.findUniqueOrThrow({ where: { id: created.id }, include: this.includeRelations() });
    });

    await this.anchorDepartmentChange(department, 'CREATE', actorId, null);
    return department;
  }

  async findAll(query: DepartmentQueryDto) {
    const { page, limit, skip } = getPagination(query);
    const where: Prisma.DepartmentWhereInput = {
      ...(query.search
        ? {
            OR: [
              { departmentCode: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.departmentCode ? { departmentCode: { contains: query.departmentCode, mode: 'insensitive' } } : {}),
      ...(query.name ? { name: { contains: query.name, mode: 'insensitive' } } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.canReceiveOrders !== undefined ? { canReceiveOrders: query.canReceiveOrders } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.department.findMany({ where, include: this.includeRelations(), orderBy: { departmentCode: 'asc' }, skip, take: limit }),
      this.prisma.department.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async update(id: string, dto: UpdateDepartmentDto, actorId?: string) {
    const existing = await this.ensureDepartment(id);
    if (dto.name) await this.assertNameUnique(dto.name, id);
    if (dto.departmentCode) await this.assertDepartmentCodeUnique(dto.departmentCode, id);
    const before = this.buildSnapshot(existing);
    const department = await this.prisma.department.update({
      where: { id },
      data: {
        ...(dto.departmentCode !== undefined ? { departmentCode: dto.departmentCode.trim() } : {}),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.floor !== undefined ? { floor: dto.floor?.trim() } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.canReceiveOrders !== undefined ? { canReceiveOrders: dto.canReceiveOrders } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() } : {}),
      },
      include: this.includeRelations(),
    });
    await this.anchorDepartmentChange(department, 'UPDATE', actorId, before);
    return department;
  }

  async assignManager(id: string, dto: AssignManagerDto, actorId?: string) {
    await this.ensureDepartment(id);
    if (dto.managerId) {
      const staff = await this.assertStaffExists(dto.managerId);
      await this.assertManagerAvailable(dto.managerId, id);
      if (staff.departmentId && staff.departmentId !== id) {
        throw new BadRequestException('Manager must belong to this department or be unassigned');
      }
      if (!staff.departmentId) await this.prisma.staffProfile.update({ where: { id: staff.id }, data: { departmentId: id } });
    }
    return this.prisma.department.update({
      where: { id },
      data: { managerId: dto.managerId || null },
      include: this.includeRelations(),
    });
  }

  async remove(id: string, actorId?: string) {
    const existing = await this.ensureDepartment(id);
    const staffCount = await this.prisma.staffProfile.count({ where: { departmentId: id } });
    if (staffCount > 0) throw new BadRequestException(`Không thể xóa khoa vì còn ${staffCount} nhân sự.`);
    const before = this.buildSnapshot(existing);
    // BlockchainLogger rows reference the department via FK; detach them so the delete
    // succeeds while preserving the historical log entries.
    await this.prisma.blockchainLogger.updateMany({ where: { departmentId: id }, data: { departmentId: null } });
    await this.prisma.department.delete({ where: { id } });
    await this.anchorDepartmentChange(existing, 'DELETE', actorId, before);
    return { deleted: true };
  }

  // ---- Tamper-evidence helpers ------------------------------------------------

  /** Business fields included in the integrity hash (excludes timestamps + hash/salt). */
  private buildSnapshot(d: any) {
    return {
      departmentCode: d.departmentCode,
      name: d.name,
      floor: d.floor ?? null,
      status: d.status,
      type: d.type,
      canReceiveOrders: d.canReceiveOrders,
      description: d.description ?? null,
      managerId: d.managerId ?? null,
    };
  }

  /**
   * Compute the integrity hash of a department, mirror it on-chain (DepartmentRegistry),
   * persist hash256/dataSalt on the row, and write a BlockchainLogger entry. On-chain
   * failures are non-fatal: the log is still written but flagged UNANCHORED so the
   * mismatch surfaces in verification rather than silently passing.
   */
  private async anchorDepartmentChange(department: any, action: AuditAction, actorId?: string, before?: unknown) {
    const snapshot = this.buildSnapshot(department);
    let dataHash: string | null = null;
    let dataSalt: string | null = null;
    let onChainStatus = 'PENDING';
    let txHash: string | null = null;
    let blockNumber: number | null = null;

    try {
      if (action === 'DELETE') {
        const res = await this.blockchain.removeDepartmentHash(department.id);
        onChainStatus = res.success ? 'ANCHORED' : 'UNANCHORED';
        txHash = (res as any).txHash ?? null;
        blockNumber = (res as any).blockNumber ?? null;
      } else {
        const { salt, hash } = this.audit.hashSnapshot(snapshot);
        dataHash = hash;
        dataSalt = salt;
        await this.prisma.department.update({ where: { id: department.id }, data: { hash256: hash, dataSalt: salt } });
        const res = await this.blockchain.setDepartmentHash(department.id, hashToBytes32(hash));
        onChainStatus = res.success ? 'ANCHORED' : 'UNANCHORED';
        txHash = (res as any).txHash ?? null;
        blockNumber = (res as any).blockNumber ?? null;
      }
    } catch {
      onChainStatus = 'UNANCHORED';
    }

    await this.audit.record({
      entity: 'Department',
      entityId: department.id,
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

  /** Change history for a department (or all departments if no id). */
  getHistory(id?: string) {
    return this.audit.history('Department', id);
  }

  /**
   * Verify a department's integrity by recomputing its hash from the live DB row and
   * comparing against both the stored hash256 and the immutable on-chain value.
   */
  async verifyDepartment(id: string) {
    const dept = await this.prisma.department.findUnique({ where: { id } });
    if (!dept) throw new NotFoundException('Department not found');
    return this.evaluateIntegrity(dept);
  }

  /** Verify every department, summarizing which rows are verified vs tampered. */
  async verifyAll() {
    const departments = await this.prisma.department.findMany({ orderBy: { departmentCode: 'asc' } });
    const items = await Promise.all(departments.map((d) => this.evaluateIntegrity(d)));
    const summary = items.reduce(
      (acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    return { total: items.length, summary, items };
  }

  private async evaluateIntegrity(dept: any) {
    const snapshot = this.buildSnapshot(dept);
    const recomputed = dept.dataSalt ? this.audit.recompute(snapshot, dept.dataSalt) : null;
    const dbHash = dept.hash256 || null;
    const onChain = await this.blockchain.getDepartmentHash(dept.id);
    const onChainNormalized = onChain ? onChain.toLowerCase() : null;
    const recomputedBytes32 = recomputed ? hashToBytes32(recomputed).toLowerCase() : null;

    const dbMatches = recomputed !== null && recomputed === dbHash;
    const chainMatches = recomputedBytes32 !== null && recomputedBytes32 === onChainNormalized;

    let status: 'VERIFIED' | 'TAMPERED' | 'UNANCHORED';
    if (!onChainNormalized) status = 'UNANCHORED';
    else if (chainMatches) status = 'VERIFIED';
    else status = 'TAMPERED';

    return {
      id: dept.id,
      departmentCode: dept.departmentCode,
      name: dept.name,
      status,
      dbMatches,
      chainMatches,
      recomputedHash: recomputed,
      storedHash: dbHash,
      onChainHash: onChain,
    };
  }

  private includeRelations() {
    return {
      manager: { include: { user: { select: this.safeUserSelect() }, doctorProfile: true } },
      staffs: { include: { user: { select: this.safeUserSelect() }, doctorProfile: true } },
    } as const;
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

  private async ensureDepartment(id: string) {
    const department = await this.prisma.department.findUnique({ where: { id } });
    if (!department) throw new NotFoundException('Department not found');
    return department;
  }

  private async assertStaffExists(id: string) {
    const staff = await this.prisma.staffProfile.findUnique({ where: { id } });
    if (!staff) throw new NotFoundException('Staff profile not found');
    return staff;
  }

  private async assertNameUnique(name: string, excludeId?: string) {
    const existing = await this.prisma.department.findUnique({ where: { name: name.trim() } });
    if (existing && existing.id !== excludeId) throw new ConflictException('Department name already exists');
  }

  private async assertDepartmentCodeUnique(departmentCode: string, excludeId?: string) {
    const existing = await this.prisma.department.findUnique({ where: { departmentCode: departmentCode.trim() } });
    if (existing && existing.id !== excludeId) throw new ConflictException('Department code already exists');
  }

  private async assertManagerAvailable(managerId: string, departmentId?: string) {
    const existing = await this.prisma.department.findFirst({ where: { managerId } });
    if (existing && existing.id !== departmentId) throw new ConflictException('Staff is already manager of another department');
  }
}

import { Inject, Injectable } from '@nestjs/common';
import {
  PARACLINICAL_SHIFT_REPOSITORY,
  ParaclinicalShiftRepositoryPort,
} from '../ports/paraclinical-shift.repository.port';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';

/**
 * List all PENDING shifts awaiting approval, optionally filtered by department.
 */
@Injectable()
export class ListPendingShiftsUseCase {
  constructor(
    @Inject(PARACLINICAL_SHIFT_REPOSITORY) private readonly repo: ParaclinicalShiftRepositoryPort,
    private readonly prisma: PrismaService,
  ) {}

  async execute(actorUserIdOrDeptId?: string, actorRole?: string, departmentId?: string) {
    if (actorRole) {
      const actorUserId = actorUserIdOrDeptId;
      if (actorRole !== 'ADMIN') {
        const staff = await this.prisma.staffProfile.findFirst({
          where: { userId: actorUserId },
          include: { managedDepartment: true },
        });
        const managedDeptId = staff?.managedDepartment?.id;
        if (!managedDeptId) {
          return [];
        }
        return this.repo.findPendingShifts(managedDeptId);
      }
      return this.repo.findPendingShifts(departmentId);
    } else {
      const deptId = actorUserIdOrDeptId;
      return this.repo.findPendingShifts(deptId);
    }
  }
}

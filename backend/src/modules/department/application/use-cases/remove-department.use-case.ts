import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DEPARTMENT_REPOSITORY, DepartmentRepositoryPort } from '../ports/department.repository.port';
import { DEPARTMENT_INTEGRITY_ANCHOR, DepartmentIntegrityAnchorPort } from '../ports/department-integrity-anchor.port';
import { DepartmentValidator } from '../services/department.validator';
import { buildDepartmentSnapshot } from '../../domain/department-snapshot';

/**
 * Deletes an empty department then anchors the DELETE. Behavior copied verbatim
 * from the former DepartmentService.remove(): blocks delete while staff remain,
 * detaches BlockchainLogger FK rows, deletes, then anchors with before-snapshot.
 */
@Injectable()
export class RemoveDepartmentUseCase {
  constructor(
    @Inject(DEPARTMENT_REPOSITORY) private readonly repo: DepartmentRepositoryPort,
    @Inject(DEPARTMENT_INTEGRITY_ANCHOR) private readonly integrity: DepartmentIntegrityAnchorPort,
    private readonly validator: DepartmentValidator,
  ) {}

  async execute(id: string, actorId?: string) {
    const existing = await this.validator.ensureDepartment(id);
    const staffCount = await this.repo.countStaff(id);
    if (staffCount > 0) throw new BadRequestException(`Không thể xóa khoa vì còn ${staffCount} nhân sự.`);
    const before = buildDepartmentSnapshot(existing);

    await this.repo.deleteWithLogDetach(id);
    await this.integrity.anchorChange(existing, 'DELETE', actorId, before);
    return { deleted: true };
  }
}

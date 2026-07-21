import { Inject, Injectable } from '@nestjs/common';
import { OperationalStatus } from '@prisma/client';
import { DEPARTMENT_REPOSITORY, DepartmentRepositoryPort } from '../ports/department.repository.port';
import { DEPARTMENT_INTEGRITY_ANCHOR, DepartmentIntegrityAnchorPort } from '../ports/department-integrity-anchor.port';
import { DepartmentValidator } from '../services/department.validator';
import { buildDepartmentSnapshot } from '../../domain/department-snapshot';
import { EntityRecoveryService } from '../../../../infrastructure/audit/entity-recovery.service';

/**
 * Soft-deletes a department by marking it DELETE, then anchors the change.
 * Hidden departments use INACTIVE and still appear in admin lists; deleted
 * departments use DELETE and are excluded from normal lists.
 */
@Injectable()
export class RemoveDepartmentUseCase {
  constructor(
    @Inject(DEPARTMENT_REPOSITORY) private readonly repo: DepartmentRepositoryPort,
    @Inject(DEPARTMENT_INTEGRITY_ANCHOR) private readonly integrity: DepartmentIntegrityAnchorPort,
    private readonly validator: DepartmentValidator,
    private readonly entityRecovery: EntityRecoveryService,
  ) {}

  async execute(id: string, actorId?: string) {
    const existing = await this.validator.ensureDepartment(id);
    await this.entityRecovery.assertTrusted('Department', id);
    const before = buildDepartmentSnapshot(existing);

    const department = await this.repo.update(id, { status: OperationalStatus.DELETE });
    await this.integrity.anchorChange(department, 'DELETE', actorId, before);
    return department;
  }
}

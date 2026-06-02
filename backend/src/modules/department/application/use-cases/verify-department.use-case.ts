import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DEPARTMENT_REPOSITORY, DepartmentRepositoryPort } from '../ports/department.repository.port';
import { DEPARTMENT_INTEGRITY_ANCHOR, DepartmentIntegrityAnchorPort } from '../ports/department-integrity-anchor.port';

/**
 * Integrity verification + change history for departments. Behavior copied
 * verbatim from the former DepartmentService (verifyDepartment, verifyAll,
 * getHistory).
 */
@Injectable()
export class VerifyDepartmentUseCase {
  constructor(
    @Inject(DEPARTMENT_REPOSITORY) private readonly repo: DepartmentRepositoryPort,
    @Inject(DEPARTMENT_INTEGRITY_ANCHOR) private readonly integrity: DepartmentIntegrityAnchorPort,
  ) {}

  async verifyOne(id: string) {
    const dept = await this.repo.findById(id);
    if (!dept) throw new NotFoundException('Department not found');
    return this.integrity.evaluate(dept);
  }

  async verifyAll() {
    const departments = await this.repo.findAllOrdered();
    const items = await Promise.all(departments.map((d) => this.integrity.evaluate(d)));
    const summary = items.reduce(
      (acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    return { total: items.length, summary, items };
  }

  history(id?: string) {
    return this.integrity.history(id);
  }
}

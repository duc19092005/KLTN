import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { STAFF_REPOSITORY, StaffRepositoryPort } from '../ports/staff.repository.port';
import { STAFF_INTEGRITY_ANCHOR, StaffIntegrityAnchorPort } from '../ports/staff-integrity-anchor.port';

/**
 * Fetch one staff (with integrity audit summary), verify one/all, and history.
 * Behavior copied verbatim from the former StaffService (findOne, verifyStaff,
 * verifyAll, getHistory).
 */
@Injectable()
export class VerifyStaffUseCase {
  constructor(
    @Inject(STAFF_REPOSITORY) private readonly repo: StaffRepositoryPort,
    @Inject(STAFF_INTEGRITY_ANCHOR) private readonly integrity: StaffIntegrityAnchorPort,
  ) {}

  async findOne(id: string) {
    const staff = await this.repo.findByIdWithStaffRelations(id);
    if (!staff) throw new NotFoundException('Staff profile not found');
    const integrity = await this.integrity.evaluate(staff);
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

  async verifyOne(id: string) {
    const staff = await this.repo.findByIdWithStaffRelations(id);
    if (!staff) throw new NotFoundException('Staff profile not found');
    return this.integrity.evaluate(staff);
  }

  async verifyAll() {
    const staffs = await this.repo.findAllOrdered();
    const items = await Promise.all(staffs.map((s) => this.integrity.evaluate(s)));
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

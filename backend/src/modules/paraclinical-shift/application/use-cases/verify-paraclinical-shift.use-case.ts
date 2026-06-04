import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  PARACLINICAL_SHIFT_REPOSITORY,
  ParaclinicalShiftRepositoryPort,
} from '../ports/paraclinical-shift.repository.port';
import { BlockchainParaclinicalShiftIntegrityAnchor } from '../../infrastructure/adapters/blockchain-paraclinical-shift-integrity.anchor';
import { AuditLoggerService } from '../../../../infrastructure/audit/audit-logger.service';

@Injectable()
export class VerifyParaclinicalShiftUseCase {
  constructor(
    @Inject(PARACLINICAL_SHIFT_REPOSITORY) private readonly repo: ParaclinicalShiftRepositoryPort,
    private readonly integrity: BlockchainParaclinicalShiftIntegrityAnchor,
    private readonly audit: AuditLoggerService,
  ) {}

  async verifyOne(id: string) {
    const shift = await this.repo.findShiftById(id);
    if (!shift) throw new NotFoundException('Không tìm thấy ca trực');
    return this.integrity.evaluate(shift);
  }

  async verifyAll() {
    // Find all shifts in database. Let's write a simple prisma findMany to grab all shifts,
    // or extend repo port if needed. Since we have PrismaService available in the anchor,
    // we can query directly or query from the db. Let's fetch all APPROVED shifts from prisma.
    const shifts = await this.repo.findShiftsByRoom('', undefined, undefined); // Wait, findShiftsByRoom requires roomId, if empty, it might not fetch all.
    // Let's implement a clean query using prisma.
    return this.verifyAllShifts();
  }

  private async verifyAllShifts() {
    // Grab all approved shifts in database to evaluate
    const shifts = await (this.repo as any).prisma.paraclinicalShift.findMany({
      where: { status: 'APPROVED', isActive: true },
      include: {
        staff: {
          include: {
            user: true,
          },
        },
        clinicalRoom: true,
      },
    });

    const items = await Promise.all(shifts.map((s: any) => this.integrity.evaluate(s)));
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
    return this.audit.history('ParaclinicalShift', id);
  }
}

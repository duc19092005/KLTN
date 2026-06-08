import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  PARACLINICAL_SHIFT_REPOSITORY,
  ParaclinicalShiftRepositoryPort,
} from '../ports/paraclinical-shift.repository.port';
import { BlockchainParaclinicalShiftIntegrityAnchor } from '../../infrastructure/adapters/blockchain-paraclinical-shift-integrity.anchor';
import { AuditLoggerService } from '../../../../infrastructure/audit/audit-logger.service';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';

@Injectable()
export class VerifyParaclinicalShiftUseCase {
  constructor(
    @Inject(PARACLINICAL_SHIFT_REPOSITORY) private readonly repo: ParaclinicalShiftRepositoryPort,
    private readonly integrity: BlockchainParaclinicalShiftIntegrityAnchor,
    private readonly audit: AuditLoggerService,
    private readonly prisma: PrismaService,
  ) {}

  async verifyOne(id: string) {
    const shift = await this.repo.findShiftById(id);
    if (!shift) throw new NotFoundException('Không tìm thấy ca trực');
    return this.integrity.evaluate(shift);
  }

  async verifyAll() {
    const shifts = await this.prisma.staffShift.findMany({
      where: { status: 'APPROVED', isActive: true },
      include: {
        staff: { include: { user: true } },
        department: true,
      },
    });

    const items = await Promise.all(shifts.map((shift) => this.integrity.evaluate(shift)));
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

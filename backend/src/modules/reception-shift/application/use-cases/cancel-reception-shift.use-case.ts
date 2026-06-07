import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import {
  RECEPTION_SHIFT_REPOSITORY,
  ReceptionShiftRepositoryPort,
} from '../ports/reception-shift.repository.port';

/**
 * Receptionists can cancel their OWN PENDING shifts (soft-delete via isActive=false).
 * APPROVED shifts cannot be unilaterally cancelled — they require manager intervention.
 */
@Injectable()
export class CancelReceptionShiftUseCase {
  constructor(
    @Inject(RECEPTION_SHIFT_REPOSITORY) private readonly repo: ReceptionShiftRepositoryPort,
    private readonly prisma: PrismaService,
  ) {}

  async execute(shiftId: string, actorUserId: string) {
    const shift = await this.repo.findById(shiftId);
    if (!shift) throw new NotFoundException('Không tìm thấy ca trực.');

    const user = await this.prisma.user.findUnique({
      where: { id: actorUserId },
      include: { staffProfile: true },
    });
    if (!user?.staffProfile || user.staffProfile.id !== shift.staffId) {
      throw new ForbiddenException('Bạn chỉ có thể hủy ca của chính mình.');
    }
    if (shift.status !== 'PENDING') {
      throw new BadRequestException('Chỉ hủy được ca có trạng thái CHỜ DUYỆT.');
    }

    return this.repo.cancel(shiftId, shift.staffId);
  }
}

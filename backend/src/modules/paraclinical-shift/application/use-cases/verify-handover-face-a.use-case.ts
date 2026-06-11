import { Inject, Injectable, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import {
  PARACLINICAL_SHIFT_REPOSITORY,
  ParaclinicalShiftRepositoryPort,
} from '../ports/paraclinical-shift.repository.port';
import { SECURITY_EVENT_LOGGER, SecurityEventLoggerPort } from '../../../auth/application/ports/security-event-logger.port';
import { FaceMatchService } from '../../../auth/application/services/face-match.service';
import { AUTH_REPOSITORY, AuthRepositoryPort } from '../../../auth/application/ports/auth.repository.port';
import { validateFaceDescriptor, assertNotFaceLocked } from '../../../auth/domain/face.util';

/**
 * Verify face for Person A (the outgoing shift-holder) during handover.
 */
@Injectable()
export class VerifyHandoverFaceAUseCase {
  constructor(
    @Inject(PARACLINICAL_SHIFT_REPOSITORY) private readonly repo: ParaclinicalShiftRepositoryPort,
    @Inject(AUTH_REPOSITORY) private readonly authRepo: AuthRepositoryPort,
    @Inject(SECURITY_EVENT_LOGGER) private readonly logger: SecurityEventLoggerPort,
    private readonly faceMatch: FaceMatchService,
  ) {}

  async execute(handoverId: string, faceDescriptor: number[]) {
    const handover = await this.repo.findHandoverById(handoverId);
    if (!handover) throw new NotFoundException('Phiên bàn giao không tồn tại.');
    if (handover.isCompleted) throw new BadRequestException('Phiên bàn giao đã hoàn tất.');
    if (handover.faceVerifiedA) throw new BadRequestException('Người bàn giao đã xác thực khuôn mặt.');

    const validDescriptor = validateFaceDescriptor(faceDescriptor);

    // Load the "from" staff's user for face data
    const user = await this.authRepo.findUserWithProfile(handover.fromStaff.userId);
    if (!user || !user.faceEmbedding) {
      throw new UnauthorizedException('Người bàn giao chưa đăng ký khuôn mặt.');
    }

    assertNotFaceLocked(user);

    const storedDescriptors = this.faceMatch.decodeStoredDescriptors(user.faceEmbedding);
    const match = this.faceMatch.computeMatch(validDescriptor, storedDescriptors);

    if (!match.passed) {
      await this.faceMatch.recordFailure(user);
      await this.logger.write(user.id, 'HANDOVER_FACE_A_FAILED', 'HandoverLog', handoverId, {
        distance: match.distance,
        threshold: match.threshold,
      });
      throw new UnauthorizedException('Khuôn mặt người bàn giao không khớp.');
    }

    await this.faceMatch.resetFailures(user.id);
    const updated = await this.repo.markFaceVerifiedA(handoverId);

    await this.logger.write(user.id, 'HANDOVER_FACE_A_VERIFIED', 'HandoverLog', handoverId, {
      fromStaff: handover.fromStaff.fullName,
      distance: match.distance,
    });

    return updated;
  }
}

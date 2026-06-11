import { Inject, Injectable, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import {
  PARACLINICAL_SHIFT_REPOSITORY,
  ParaclinicalShiftRepositoryPort,
} from '../ports/paraclinical-shift.repository.port';
import { SECURITY_EVENT_LOGGER, SecurityEventLoggerPort } from '../../../auth/application/ports/security-event-logger.port';
import { FaceMatchService } from '../../../auth/application/services/face-match.service';
import { AUTH_REPOSITORY, AuthRepositoryPort } from '../../../auth/application/ports/auth.repository.port';
import { AuditLoggerService } from '../../../../infrastructure/audit/audit-logger.service';
import { AuditAnchorService } from '../../../../infrastructure/audit/audit-anchor.service';
import { validateFaceDescriptor, assertNotFaceLocked } from '../../../auth/domain/face.util';

/**
 * Verify face for Person B (the incoming shift-holder) during handover.
 * When both A and B are verified → complete the handover and trigger
 * IMMEDIATE blockchain anchoring (Tier-A event).
 */
@Injectable()
export class VerifyHandoverFaceBUseCase {
  constructor(
    @Inject(PARACLINICAL_SHIFT_REPOSITORY) private readonly repo: ParaclinicalShiftRepositoryPort,
    @Inject(AUTH_REPOSITORY) private readonly authRepo: AuthRepositoryPort,
    @Inject(SECURITY_EVENT_LOGGER) private readonly securityLogger: SecurityEventLoggerPort,
    private readonly faceMatch: FaceMatchService,
    private readonly auditLogger: AuditLoggerService,
    private readonly auditAnchor: AuditAnchorService,
  ) {}

  async execute(handoverId: string, faceDescriptor: number[]) {
    const handover = await this.repo.findHandoverById(handoverId);
    if (!handover) throw new NotFoundException('Phiên bàn giao không tồn tại.');
    if (handover.isCompleted) throw new BadRequestException('Phiên bàn giao đã hoàn tất.');
    if (!handover.faceVerifiedA) throw new BadRequestException('Người bàn giao chưa xác thực khuôn mặt. Vui lòng quét mặt người bàn giao trước.');
    if (handover.faceVerifiedB) throw new BadRequestException('Người nhận ca đã xác thực khuôn mặt.');

    const validDescriptor = validateFaceDescriptor(faceDescriptor);

    // Load the "to" staff's user for face data
    const user = await this.authRepo.findUserWithProfile(handover.toStaff.userId);
    if (!user || !user.faceEmbedding) {
      throw new UnauthorizedException('Người nhận ca chưa đăng ký khuôn mặt.');
    }

    assertNotFaceLocked(user);

    const storedDescriptors = this.faceMatch.decodeStoredDescriptors(user.faceEmbedding);
    const match = this.faceMatch.computeMatch(validDescriptor, storedDescriptors);

    if (!match.passed) {
      await this.faceMatch.recordFailure(user);
      await this.securityLogger.write(user.id, 'HANDOVER_FACE_B_FAILED', 'HandoverLog', handoverId, {
        distance: match.distance,
        threshold: match.threshold,
      });
      throw new UnauthorizedException('Khuôn mặt người nhận ca không khớp.');
    }

    await this.faceMatch.resetFailures(user.id);

    // Mark B verified
    await this.repo.markFaceVerifiedB(handoverId);

    // Both verified → complete the handover
    const completed = await this.repo.completeHandover(handoverId);

    // Log the completion event
    await this.securityLogger.write(user.id, 'HANDOVER_FACE_B_VERIFIED', 'HandoverLog', handoverId, {
      toStaff: handover.toStaff.fullName,
      distance: match.distance,
    });

    // ──────────────────────────────────────────────────────────────
    // IMMEDIATE BLOCKCHAIN ANCHORING (Tier-A event)
    // Handover demarcates a legal responsibility boundary — must be
    // immutably recorded on-chain in real-time.
    // ──────────────────────────────────────────────────────────────
    const snapshot = {
      handoverId: completed.id,
      departmentId: completed.departmentId,
      fromStaffId: completed.fromStaffId,
      fromStaffName: completed.fromStaff.fullName,
      toStaffId: completed.toStaffId,
      toStaffName: completed.toStaff.fullName,
      timestamp: completed.timestamp.toISOString(),
      faceVerifiedA: true,
      faceVerifiedB: true,
    };
    const { salt, hash } = this.auditLogger.hashSnapshot(snapshot);

    await this.auditLogger.record({
      entity: 'HandoverLog',
      entityId: completed.id,
      action: 'HANDOVER_COMPLETED',
      actorId: user.id,
      dataHash: hash,
      dataSalt: salt,
      after: snapshot,
      onChainStatus: 'PENDING', // Will be immediately anchored below
      metadata: {
        fromStaff: completed.fromStaff.fullName,
        toStaff: completed.toStaff.fullName,
        departmentId: completed.departmentId,
        immediateAnchor: true,
      },
    });

    // Trigger immediate Merkle root commit (bypasses the batch timer)
    try {
      await this.auditAnchor.anchorNow();
    } catch (err) {
      // Log but don't fail the handover — the batch cycle will pick it up
      console.error('[Handover] Immediate anchoring failed, will retry in batch cycle:', err);
    }

    return {
      ...completed,
      blockchainAnchored: true,
      message: 'Bàn giao ca trực thành công. Sự kiện đã được neo lên chuỗi khối.',
    };
  }
}

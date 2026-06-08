import { Inject, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  PARACLINICAL_SHIFT_REPOSITORY,
  ParaclinicalShiftRepositoryPort,
} from '../ports/paraclinical-shift.repository.port';
import { SECURITY_EVENT_LOGGER, SecurityEventLoggerPort } from '../../../auth/application/ports/security-event-logger.port';
import { FaceMatchService } from '../../../auth/application/services/face-match.service';
import { validateFaceDescriptor, assertNotFaceLocked } from '../../../auth/domain/face.util';
import { BlockchainParaclinicalShiftIntegrityAnchor } from '../../infrastructure/adapters/blockchain-paraclinical-shift-integrity.anchor';

/**
 * Phase 2 of shared-account login:
 * Validate the temp token → find active shifts for the room(s) the shared account covers →
 * match the submitted face descriptor against the scheduled staff → issue a full JWT
 * identifying the actual person.
 */
@Injectable()
export class VerifyShiftFaceUseCase {
  constructor(
    @Inject(PARACLINICAL_SHIFT_REPOSITORY) private readonly repo: ParaclinicalShiftRepositoryPort,
    @Inject(SECURITY_EVENT_LOGGER) private readonly logger: SecurityEventLoggerPort,
    private readonly jwtService: JwtService,
    private readonly faceMatch: FaceMatchService,
    private readonly shiftIntegrity: BlockchainParaclinicalShiftIntegrityAnchor,
  ) {}

  async execute(tempToken: string, faceDescriptor: number[]) {
    // 1. Verify the temporary token
    let payload: { sub: string; purpose: string; username: string };
    try {
      payload = this.jwtService.verify(tempToken);
    } catch {
      throw new UnauthorizedException('Token tạm thời đã hết hạn hoặc không hợp lệ.');
    }

    if (payload.purpose !== 'paraclinical-face-scan') {
      throw new UnauthorizedException('Token không hợp lệ cho mục đích này.');
    }

    // 2. Validate the face descriptor format
    const validDescriptor = validateFaceDescriptor(faceDescriptor);

    // 3. Determine the department for this shared account.
    //    DEPT_SHARED users don't have a StaffProfile — find via Department.sharedUserId.
    //    Fallback: try StaffProfile for backward compatibility.
    let departmentId: string | null = null;

    const dept = await this.repo.findDepartmentBySharedUserId(payload.sub);
    if (dept) {
      departmentId = dept.id;
    } else {
      const staff = await this.repo.findStaffByUserId(payload.sub);
      if (staff?.departmentId) {
        departmentId = staff.departmentId;
      }
    }

    if (!departmentId) {
      throw new ForbiddenException('Tài khoản không được liên kết với khoa nào.');
    }

    const rooms = await this.repo.findRoomsByDepartmentStaff(departmentId);
    if (rooms.length === 0) {
      throw new ForbiddenException('Chỉ nhân viên có ca trực đã được duyệt và đang trong giờ làm mới được quét khuôn mặt để đăng nhập.');
    }

    // 4. Gather all active shifts across all rooms in the department
    const now = new Date();
    let matchedShift = null;
    let matchedUser = null;

    for (const room of rooms) {
      const activeShifts = await this.repo.findActiveShiftsForRoom(room.id, now);
      for (const shift of activeShifts) {
        // Validate active shift integrity
        const integrity = await this.shiftIntegrity.evaluate(shift);
        if (integrity.status === 'TAMPERED') {
          throw new ForbiddenException(
            'Phát hiện dữ liệu ca trực bị sửa đổi trái phép (Tampered). Vui lòng liên hệ Quản trị viên.',
          );
        }

        const user = shift.staff.user;
        if (!user.faceEmbedding) continue;

        // Check lockout
        try {
          assertNotFaceLocked(user);
        } catch {
          continue; // skip locked users
        }

        // Decode stored descriptors and compute match
        try {
          const storedDescriptors = this.faceMatch.decodeStoredDescriptors(user.faceEmbedding);
          const result = this.faceMatch.computeMatch(validDescriptor, storedDescriptors);
          if (result.passed) {
            matchedShift = shift;
            matchedUser = user;
            break;
          }
        } catch {
          continue; // skip malformed face data
        }
      }
      if (matchedShift) break;
    }

    if (!matchedShift || !matchedUser) {
      await this.logger.write(payload.sub, 'PARACLINICAL_FACE_MISMATCH', 'User', payload.sub, {
        reason: 'No matching face found in active shifts',
      });
      throw new UnauthorizedException(
        'Khuôn mặt không khớp với bất kỳ nhân viên nào đang trực ca hiện tại.',
      );
    }

    // 5. Issue a full JWT identifying the actual staff member
    const fullToken = this.jwtService.sign({
      sub: matchedUser.id,
      username: payload.username,
      role: matchedUser.role,
      staffId: matchedShift.staffId,
      staffName: matchedShift.staff.fullName,
      shiftId: matchedShift.id,
      clinicalRoomId: matchedShift.clinicalRoomId,
      verified: true,
      isFirstLogin: false,
      tokenVersion: matchedUser.tokenVersion,
      sharedAccountId: payload.sub,
      actualStaffId: matchedUser.id,
    });

    await this.logger.write(matchedUser.id, 'PARACLINICAL_LOGIN_SUCCESS', 'User', matchedUser.id, {
      staffId: matchedShift.staffId,
      staffName: matchedShift.staff.fullName,
      shiftId: matchedShift.id,
      room: matchedShift.clinicalRoom.roomName,
    });

    // Reset face failures on success
    await this.faceMatch.resetFailures(matchedUser.id);

    return {
      access_token: fullToken,
      user: {
        id: matchedUser.id,
        username: payload.username,
        role: matchedUser.role,
        staffId: matchedShift.staffId,
        staffName: matchedShift.staff.fullName,
        shiftId: matchedShift.id,
        clinicalRoomId: matchedShift.clinicalRoomId,
        roomName: matchedShift.clinicalRoom.roomName,
        verified: true,
      },
    };
  }
}

import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import {
  PARACLINICAL_SHIFT_REPOSITORY,
  ParaclinicalShiftRepositoryPort,
} from '../ports/paraclinical-shift.repository.port';
import { AuditLoggerService } from '../../../../infrastructure/audit/audit-logger.service';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';

/**
 * Register a shift for the current staff member.
 * Creates a PENDING shift and anchors a tamper-evidence hash of the registration on
 * the BlockchainLogger (PENDING on-chain → batch Merkle anchoring).
 *
 * Business rule: Technicians (LAB_MANAGER) work in technical/paraclinical rooms.
 * Doctors work in clinical rooms via the Visit workflow, not shifts.
 *
 * Atomicity: the shift is created first, then anchored. If anchoring fails we compensate
 * by hard-deleting the just-created shift so a row never exists without its integrity anchor.
 */
@Injectable()
export class RegisterShiftUseCase {
  constructor(
    @Inject(PARACLINICAL_SHIFT_REPOSITORY) private readonly repo: ParaclinicalShiftRepositoryPort,
    private readonly auditLogger: AuditLoggerService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    staffId: string,
    clinicalRoomId: string,
    startTime: Date,
    endTime: Date,
    actorId: string,
    note?: string,
  ) {
    // Validate time range
    if (startTime >= endTime) {
      throw new BadRequestException('Thời gian bắt đầu phải trước thời gian kết thúc.');
    }
    if (startTime < new Date()) {
      throw new BadRequestException('Không thể đăng ký ca trực trong quá khứ.');
    }

    const trimmedNote = note?.trim() || null;
    const shift = await this.repo.createShift({ staffId, clinicalRoomId, startTime, endTime, note: trimmedNote });

    // Compute tamper-evidence hash for the PENDING registration and anchor it on-chain.
    const snapshot = {
      staffId,
      clinicalRoomId,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      status: 'PENDING',
    };
    const { salt, hash } = this.auditLogger.hashSnapshot(snapshot);

    try {
      await this.repo.setShiftHash(shift.id, hash, salt);
      await this.auditLogger.record({
        entity: 'ParaclinicalShift',
        entityId: shift.id,
        action: 'SHIFT_REGISTERED',
        actorId,
        dataHash: hash,
        dataSalt: salt,
        after: snapshot,
        onChainStatus: 'PENDING',
        metadata: {
          staffName: shift.staff.fullName,
          room: shift.clinicalRoom.roomName,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          hasNote: Boolean(trimmedNote),
        },
      });
    } catch (err) {
      // Compensation: anchoring failed → remove the orphan shift and surface the error.
      await this.repo.hardDeleteShift(shift.id).catch(() => undefined);
      throw new BadRequestException('Đăng ký ca trực thất bại khi neo dữ liệu lên blockchain. Vui lòng thử lại.');
    }

    return { ...shift, hash256: hash, dataSalt: salt };
  }

  /**
   * Resolve a potential department ID to a ClinicalRoom ID.
   * Lab staff register shifts against their department (Lab/Imaging), but
   * ParaclinicalShift requires a ClinicalRoom. This method finds or creates
   * a ClinicalRoom auto-mapped to the department so shifts work seamlessly.
   */
  async resolveClinicalRoom(roomOrDeptId: string): Promise<string> {
    // 1. Check if it's already a ClinicalRoom
    const existingRoom = await this.prisma.clinicalRoom.findUnique({
      where: { id: roomOrDeptId },
      select: { id: true },
    });
    if (existingRoom) return existingRoom.id;

    // 2. Check if it's a Department (LABORATORY / IMAGING)
    const department = await this.prisma.department.findUnique({
      where: { id: roomOrDeptId },
      select: { id: true, name: true, departmentCode: true, type: true },
    });

    if (!department || (department.type !== 'LABORATORY' && department.type !== 'IMAGING')) {
      // Not a valid department for paraclinical shifts — let the original flow error out
      throw new BadRequestException('Invalid clinical room or department for paraclinical shift');
    }

    // 3. Check if a ClinicalRoom already exists for this department (by roomCode = dept.departmentCode)
    const autoRoom = await this.prisma.clinicalRoom.findFirst({
      where: { roomCode: department.departmentCode },
      select: { id: true },
    });
    if (autoRoom) return autoRoom.id;

    // 4. Auto-create a ClinicalRoom for this department
    const newRoom = await this.prisma.clinicalRoom.create({
      data: {
        roomCode: department.departmentCode,
        roomName: `${department.name}`,
        floor: '01',
        description: `Auto-generated room for ${department.type === 'LABORATORY' ? 'Laboratory' : 'Imaging'} department: ${department.name}`,
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    return newRoom.id;
  }
}

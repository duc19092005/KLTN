import { Injectable } from '@nestjs/common';
import { RegisterShiftUseCase } from '../application/use-cases/register-shift.use-case';
import { ApproveShiftUseCase } from '../application/use-cases/approve-shift.use-case';
import { RejectShiftUseCase } from '../application/use-cases/reject-shift.use-case';
import { AssignShiftUseCase } from '../application/use-cases/assign-shift.use-case';
import { ListRoomShiftsUseCase } from '../application/use-cases/list-room-shifts.use-case';
import { ListPendingShiftsUseCase } from '../application/use-cases/list-pending-shifts.use-case';
import { ParaclinicalLoginUseCase } from '../application/use-cases/paraclinical-login.use-case';
import { VerifyShiftFaceUseCase } from '../application/use-cases/verify-shift-face.use-case';
import { InitiateHandoverUseCase } from '../application/use-cases/initiate-handover.use-case';
import { VerifyHandoverFaceAUseCase } from '../application/use-cases/verify-handover-face-a.use-case';
import { VerifyHandoverFaceBUseCase } from '../application/use-cases/verify-handover-face-b.use-case';
import { VerifyParaclinicalShiftUseCase } from '../application/use-cases/verify-paraclinical-shift.use-case';

/**
 * Facade preserving a stable API surface. Each method delegates to a single use case.
 */
@Injectable()
export class ParaclinicalShiftService {
  constructor(
    private readonly registerShiftUC: RegisterShiftUseCase,
    private readonly approveShiftUC: ApproveShiftUseCase,
    private readonly rejectShiftUC: RejectShiftUseCase,
    private readonly assignShiftUC: AssignShiftUseCase,
    private readonly listRoomShiftsUC: ListRoomShiftsUseCase,
    private readonly listPendingShiftsUC: ListPendingShiftsUseCase,
    private readonly paraclinicalLoginUC: ParaclinicalLoginUseCase,
    private readonly verifyShiftFaceUC: VerifyShiftFaceUseCase,
    private readonly initiateHandoverUC: InitiateHandoverUseCase,
    private readonly verifyHandoverFaceAUC: VerifyHandoverFaceAUseCase,
    private readonly verifyHandoverFaceBUC: VerifyHandoverFaceBUseCase,
    private readonly verifyShiftUC: VerifyParaclinicalShiftUseCase,
  ) {}

  async registerShift(staffIdOrUserId: string, clinicalRoomId: string, startTime: Date, endTime: Date, actorId: string, note?: string, demoMode = false) {
    // Auto-resolve: if clinicalRoomId is actually a department ID, find or create a ClinicalRoom
    let resolvedRoomId = clinicalRoomId;
    try {
      resolvedRoomId = await this.registerShiftUC.resolveClinicalRoom(clinicalRoomId);
    } catch { /* keep original, let use-case throw proper error */ }

    // Auto-resolve: if staffIdOrUserId is actually a User.id, find the real StaffProfile.id
    let staffId = staffIdOrUserId;
    try {
      const staff = await this.registerShiftUC.resolveStaffId(staffIdOrUserId);
      if (staff) staffId = staff;
    } catch { /* keep original */ }

    return this.registerShiftUC.execute(staffId, resolvedRoomId, startTime, endTime, actorId, note, demoMode);
  }

  approveShift(shiftId: string, approvedById: string) {
    return this.approveShiftUC.execute(shiftId, approvedById);
  }

  rejectShift(shiftId: string, rejectedById: string) {
    return this.rejectShiftUC.execute(shiftId, rejectedById);
  }

  async assignShift(staffId: string, clinicalRoomId: string, startTime: Date, endTime: Date, approvedById: string) {
    // Auto-resolve if clinicalRoomId is actually a department ID
    let resolvedRoomId = clinicalRoomId;
    try {
      resolvedRoomId = await this.registerShiftUC.resolveClinicalRoom(clinicalRoomId);
    } catch { /* keep original */ }
    return this.assignShiftUC.execute(staffId, resolvedRoomId, startTime, endTime, approvedById);
  }

  async listRoomShifts(roomId: string, from?: Date, to?: Date) {
    // Auto-resolve if roomId is actually a department ID
    let resolvedRoomId = roomId;
    try {
      resolvedRoomId = await this.registerShiftUC.resolveClinicalRoom(roomId);
    } catch { /* keep original */ }
    return this.listRoomShiftsUC.execute(resolvedRoomId, from, to);
  }

  listPendingShifts(departmentId?: string) {
    return this.listPendingShiftsUC.execute(departmentId);
  }

  paraclinicalLogin(username: string, password: string) {
    return this.paraclinicalLoginUC.execute(username, password);
  }

  verifyShiftFace(tempToken: string, faceDescriptor: number[]) {
    return this.verifyShiftFaceUC.execute(tempToken, faceDescriptor);
  }

  initiateHandover(fromStaffId: string, toStaffId: string, clinicalRoomId: string, reason?: string) {
    return this.initiateHandoverUC.execute(fromStaffId, toStaffId, clinicalRoomId, reason);
  }

  verifyHandoverFaceA(handoverId: string, faceDescriptor: number[]) {
    return this.verifyHandoverFaceAUC.execute(handoverId, faceDescriptor);
  }

  verifyHandoverFaceB(handoverId: string, faceDescriptor: number[]) {
    return this.verifyHandoverFaceBUC.execute(handoverId, faceDescriptor);
  }

  verifyShift(id: string) {
    return this.verifyShiftUC.verifyOne(id);
  }

  verifyAllShifts() {
    return this.verifyShiftUC.verifyAll();
  }

  getHistory(id?: string) {
    return this.verifyShiftUC.history(id);
  }
}

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

  registerShift(staffId: string, clinicalRoomId: string, startTime: Date, endTime: Date, actorId: string) {
    return this.registerShiftUC.execute(staffId, clinicalRoomId, startTime, endTime, actorId);
  }

  approveShift(shiftId: string, approvedById: string) {
    return this.approveShiftUC.execute(shiftId, approvedById);
  }

  rejectShift(shiftId: string, rejectedById: string) {
    return this.rejectShiftUC.execute(shiftId, rejectedById);
  }

  assignShift(staffId: string, clinicalRoomId: string, startTime: Date, endTime: Date, approvedById: string) {
    return this.assignShiftUC.execute(staffId, clinicalRoomId, startTime, endTime, approvedById);
  }

  listRoomShifts(roomId: string, from?: Date, to?: Date) {
    return this.listRoomShiftsUC.execute(roomId, from, to);
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

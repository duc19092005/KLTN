import { ShiftCode, ShiftStatus } from '@prisma/client';

/** DI token for the ParaclinicalShift repository port. */
export const PARACLINICAL_SHIFT_REPOSITORY = Symbol('PARACLINICAL_SHIFT_REPOSITORY');

export type CreateShiftData = {
  staffId: string;
  departmentId: string;
  workDate: Date;
  shiftCode: ShiftCode;
  startTime: Date;
  endTime: Date;
  note?: string | null;
};

export type AssignShiftData = CreateShiftData & {
  approvedById: string;
};

export type ShiftWithStaff = {
  id: string;
  staffId: string;
  departmentId: string;
  workDate: Date;
  shiftCode: ShiftCode;
  startTime: Date;
  endTime: Date;
  status: ShiftStatus;
  note: string | null;
  rejectionReason: string | null;
  approvedById: string | null;
  isActive: boolean;
  hash256: string | null;
  dataSalt: string | null;
  createdAt: Date;
  updatedAt: Date;
  staff: {
    id: string;
    fullName: string;
    userId: string;
    user: {
      id: string;
      username: string;
      role: string;
      faceEmbedding: string | null;
      faceHash: string | null;
      failedFaceAttempts: number;
      faceLockedUntil: Date | null;
      tokenVersion: number;
    };
    department: { id: string; name: string; type: string } | null;
    doctorProfile: { id: string } | null;
  };
  department: {
    id: string;
    departmentCode: string;
    name: string;
    type: string;
  };
};

export type HandoverLogFull = {
  id: string;
  departmentId: string;
  fromStaffId: string;
  toStaffId: string;
  reason: string | null;
  timestamp: Date;
  faceVerifiedA: boolean;
  faceVerifiedB: boolean;
  isCompleted: boolean;
  fromStaff: { id: string; fullName: string; userId: string };
  toStaff: { id: string; fullName: string; userId: string };
};

export interface ParaclinicalShiftRepositoryPort {
  createShift(data: CreateShiftData): Promise<ShiftWithStaff>;
  assignShift(data: AssignShiftData): Promise<ShiftWithStaff>;
  findShiftById(id: string): Promise<ShiftWithStaff | null>;
  approveShift(id: string, approvedById: string, hash256: string, dataSalt: string): Promise<ShiftWithStaff>;
  rejectShift(id: string, approvedById: string, reason?: string | null): Promise<ShiftWithStaff>;
  setShiftHash(id: string, hash256: string, dataSalt: string): Promise<ShiftWithStaff>;
  hardDeleteShift(id: string): Promise<void>;
  revertToPending(id: string): Promise<void>;

  findShiftsByDepartment(departmentId: string, from?: Date, to?: Date): Promise<ShiftWithStaff[]>;
  findPendingShifts(departmentId?: string): Promise<ShiftWithStaff[]>;
  findActiveShiftForDepartment(departmentId: string, now: Date): Promise<ShiftWithStaff | null>;
  findActiveShiftsForDepartment(departmentId: string, now: Date): Promise<ShiftWithStaff[]>;
  findActiveShiftForStaffDepartment(staffId: string, departmentId: string, now: Date, includeOutOfWindow?: boolean): Promise<ShiftWithStaff | null>;
  hasStaffShiftOnDateCode(staffId: string, workDate: Date, shiftCode: ShiftCode, excludeId?: string): Promise<boolean>;
  hasOverlappingShift(departmentId: string, startTime: Date, endTime: Date, excludeId?: string): Promise<boolean>;

  createHandoverLog(data: {
    departmentId: string;
    fromStaffId: string;
    toStaffId: string;
    reason?: string;
  }): Promise<HandoverLogFull>;
  findHandoverById(id: string): Promise<HandoverLogFull | null>;
  markFaceVerifiedA(id: string): Promise<HandoverLogFull>;
  markFaceVerifiedB(id: string): Promise<HandoverLogFull>;
  completeHandover(id: string): Promise<HandoverLogFull>;

  findStaffByUserId(userId: string): Promise<{
    id: string;
    fullName: string;
    userId: string;
    departmentId: string | null;
  } | null>;
}

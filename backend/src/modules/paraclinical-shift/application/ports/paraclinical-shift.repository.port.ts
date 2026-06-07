import { ShiftStatus } from '@prisma/client';

/** DI token for the ParaclinicalShift repository port. */
export const PARACLINICAL_SHIFT_REPOSITORY = Symbol('PARACLINICAL_SHIFT_REPOSITORY');

export type CreateShiftData = {
  staffId: string;
  clinicalRoomId: string;
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
  clinicalRoomId: string;
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
    };
    department: { id: string; name: string; type: string } | null;
    doctorProfile: { id: string } | null;
  };
  clinicalRoom: {
    id: string;
    roomCode: string;
    roomName: string;
  };
};

export type HandoverLogFull = {
  id: string;
  clinicalRoomId: string;
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

/**
 * Persistence boundary for ParaclinicalShift and HandoverLog aggregates.
 */
export interface ParaclinicalShiftRepositoryPort {
  // ── Shift management ──────────────────────────────────────────
  createShift(data: CreateShiftData): Promise<ShiftWithStaff>;
  assignShift(data: AssignShiftData): Promise<ShiftWithStaff>;
  findShiftById(id: string): Promise<ShiftWithStaff | null>;
  approveShift(id: string, approvedById: string, hash256: string, dataSalt: string): Promise<ShiftWithStaff>;
  rejectShift(id: string, approvedById: string, reason?: string | null): Promise<ShiftWithStaff>;

  /** Persist integrity hash for a freshly-registered (PENDING) shift. */
  setShiftHash(id: string, hash256: string, dataSalt: string): Promise<ShiftWithStaff>;
  /** Compensation: hard-delete a shift (used when post-create anchoring fails). */
  hardDeleteShift(id: string): Promise<void>;
  /** Compensation: revert an approved shift back to PENDING (used when anchoring fails). */
  revertToPending(id: string): Promise<void>;
  findShiftsByRoom(roomId: string, from?: Date, to?: Date): Promise<ShiftWithStaff[]>;
  findPendingShifts(departmentId?: string): Promise<ShiftWithStaff[]>;

  /** Find the APPROVED shift covering `now` for a given room. */
  findActiveShiftForRoom(roomId: string, now: Date): Promise<ShiftWithStaff | null>;

  /** Find all APPROVED shifts covering `now` for a given room (for multi-staff matching). */
  findActiveShiftsForRoom(roomId: string, now: Date): Promise<ShiftWithStaff[]>;

  /** Check for overlapping approved shifts. */
  hasOverlappingShift(roomId: string, startTime: Date, endTime: Date, excludeId?: string): Promise<boolean>;

  // ── Handover management ───────────────────────────────────────
  createHandoverLog(data: {
    clinicalRoomId: string;
    fromStaffId: string;
    toStaffId: string;
    reason?: string;
  }): Promise<HandoverLogFull>;
  findHandoverById(id: string): Promise<HandoverLogFull | null>;
  markFaceVerifiedA(id: string): Promise<HandoverLogFull>;
  markFaceVerifiedB(id: string): Promise<HandoverLogFull>;
  completeHandover(id: string): Promise<HandoverLogFull>;

  // ── Shared account helpers ────────────────────────────────────
  findUserByUsername(username: string): Promise<{
    id: string;
    username: string;
    passwordHash: string | null;
    role: string;
    status: string;
  } | null>;

  findStaffByUserId(userId: string): Promise<{
    id: string;
    fullName: string;
    userId: string;
    departmentId: string | null;
  } | null>;

  /** Find rooms linked to a department (for shared-account room scoping). */
  findRoomsByDepartmentStaff(departmentId: string): Promise<{ id: string; roomCode: string; roomName: string }[]>;

  /** Find the department linked to a DEPT_SHARED user. */
  findDepartmentBySharedUserId(userId: string): Promise<{ id: string; name: string } | null>;
}

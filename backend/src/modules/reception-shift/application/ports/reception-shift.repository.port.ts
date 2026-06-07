import { ReceptionShift, ShiftStatus } from '@prisma/client';

export const RECEPTION_SHIFT_REPOSITORY = Symbol('RECEPTION_SHIFT_REPOSITORY');

export interface ReceptionShiftWithRelations extends ReceptionShift {
  staff?: any;
  department?: any;
  approvedBy?: any;
}

export interface CreateReceptionShiftData {
  staffId: string;
  departmentId: string;
  startTime: Date;
  endTime: Date;
  status: ShiftStatus;
  note?: string | null;
  approvedById?: string | null;
}

export interface ListReceptionShiftsFilter {
  staffId?: string;
  departmentId?: string;
  status?: ShiftStatus;
  fromDate?: Date;
  toDate?: Date;
}

/**
 * Repository port for reception shift persistence. Concrete adapter lives under
 * infrastructure/prisma. Use cases depend ONLY on this interface, not on Prisma.
 */
export interface ReceptionShiftRepositoryPort {
  create(data: CreateReceptionShiftData): Promise<ReceptionShiftWithRelations>;

  findById(id: string): Promise<ReceptionShiftWithRelations | null>;

  list(filter: ListReceptionShiftsFilter): Promise<ReceptionShiftWithRelations[]>;

  /**
   * Find any APPROVED or PENDING shift overlapping [startTime, endTime] for the staff.
   * Used to prevent double-booking when registering a new shift.
   */
  findOverlapping(staffId: string, startTime: Date, endTime: Date, excludeId?: string): Promise<ReceptionShiftWithRelations | null>;

  updateStatus(id: string, status: ShiftStatus, approvedById: string | null, rejectionReason?: string | null): Promise<ReceptionShiftWithRelations>;

  cancel(id: string, staffId: string): Promise<ReceptionShiftWithRelations>;

  countTodayByDepartment(departmentId: string, day: Date): Promise<number>;
}

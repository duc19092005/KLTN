import { OperationalStatus } from '@prisma/client';

/** DI token for the ClinicalRoom repository port. */
export const CLINICAL_ROOM_REPOSITORY = Symbol('CLINICAL_ROOM_REPOSITORY');

export type ClinicalRoomListFilter = {
  roomCode?: string;
  roomName?: string;
  status?: OperationalStatus;
  search?: string;
};

export type CreateClinicalRoomData = {
  roomCode: string;
  roomName: string;
  doctorId?: string | null;
  floor?: string;
  description?: string;
  status: OperationalStatus;
};

export type UpdateClinicalRoomData = {
  roomCode?: string;
  roomName?: string;
  doctorId?: string | null;
  floor?: string;
  description?: string;
  status?: OperationalStatus;
};

/**
 * Persistence boundary for the ClinicalRoom aggregate. The Prisma implementation
 * keeps the include shapes and the transactions that enforce one-room-per-doctor
 * (clearing a doctor's previous room before assigning a new one).
 */
export interface ClinicalRoomRepositoryPort {
  findById(id: string): Promise<{ id: string } | null>;
  findByRoomCode(roomCode: string): Promise<{ id: string } | null>;
  doctorExists(doctorId: string): Promise<boolean>;

  /** Atomic: clear the doctor's previous room (if any) then create the room. */
  createWithDoctorReassign(data: CreateClinicalRoomData): Promise<any>;

  findManyPaginated(filter: ClinicalRoomListFilter, skip: number, take: number): Promise<{ items: unknown[]; total: number }>;

  /** Atomic: clear the doctor's previous room (excluding this one) then update. */
  updateWithDoctorReassign(id: string, data: UpdateClinicalRoomData): Promise<any>;

  /** Atomic: clear the doctor's previous room (excluding this one) then set this room's doctor. */
  assignDoctor(id: string, doctorId?: string | null): Promise<any>;

  delete(id: string): Promise<void>;
}

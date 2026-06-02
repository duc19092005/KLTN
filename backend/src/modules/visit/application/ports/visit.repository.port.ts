import { Prisma, VisitStatus } from '@prisma/client';

/** DI token for the Visit repository port. */
export const VISIT_REPOSITORY = Symbol('VISIT_REPOSITORY');

/** Patient payload used when intake creates a brand new patient inline. */
export type CreateVisitPatientInput = {
  fullName: string;
  gender: string;
  birthDate: string;
  citizenId?: string;
  phone?: string;
  address?: string;
  insuranceNumber?: string;
  emergencyContact?: string;
};

/** Command to create a visit, optionally creating the patient in the same transaction. */
export type CreateVisitCommand = {
  patientId?: string;
  patient?: CreateVisitPatientInput;
  clinicalRoomId: string;
  doctorId: string;
};

export type VisitListFilter = {
  status?: VisitStatus;
  doctorId?: string;
  clinicalRoomId?: string;
  patientId?: string;
};

/** Minimal visit shape used for policy/ownership checks (no relations). */
export type VisitEntity = {
  id: string;
  patientId: string;
  doctorId: string;
  clinicalRoomId: string;
  status: VisitStatus;
};

/**
 * Persistence boundary for the Visit aggregate. The Prisma implementation keeps
 * include shapes, code generation and the create transaction; the application
 * layer depends only on this port.
 */
export interface VisitRepositoryPort {
  findById(id: string): Promise<VisitEntity | null>;
  findRoomWithDoctor(roomId: string): Promise<{ id: string; doctorId: string | null } | null>;
  findDoctorProfileById(doctorId: string): Promise<{ id: string } | null>;
  /** Returns the DoctorProfile id linked to a user, or null if none. */
  findDoctorIdByUserId(userId: string): Promise<string | null>;

  /** Atomic intake: optional patient creation + unique code generation + visit creation, with retry. */
  createVisitWithOptionalPatient(command: CreateVisitCommand): Promise<unknown>;

  findManyPaginated(filter: VisitListFilter, skip: number, take: number): Promise<{ items: unknown[]; total: number }>;

  updateStatus(id: string, status: VisitStatus, completedAt?: Date): Promise<unknown>;

  suggestRooms(specialty: string): Promise<unknown[]>;
}

/** Detects a unique-constraint conflict on patientCode/visitCode for retry. */
export function isUniqueVisitCodeConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    Array.isArray(error.meta?.target) &&
    ((error.meta.target as string[]).includes('patientCode') ||
      (error.meta.target as string[]).includes('visitCode'))
  );
}

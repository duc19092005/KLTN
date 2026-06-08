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
  departmentId: string;
  staffId?: string | null;
};

export type VisitListFilter = {
  status?: VisitStatus;
  staffId?: string;
  departmentId?: string;
  patientId?: string;
};

/** Minimal visit shape used for policy/ownership checks (no relations). */
export type VisitEntity = {
  id: string;
  patientId: string;
  departmentId: string;
  staffId: string | null;
  status: VisitStatus;
};

export type VisitDoctorStaff = {
  doctorId: string;
  staffId: string;
  departmentId: string | null;
};

/**
 * Persistence boundary for the Visit aggregate. The Prisma implementation keeps
 * include shapes, code generation and the create transaction; the application
 * layer depends only on this port.
 */
export interface VisitRepositoryPort {
  findById(id: string): Promise<VisitEntity | null>;
  findDepartmentForVisit(departmentId: string): Promise<{ id: string; type: string; status: string } | null>;
  /** Returns the DoctorProfile + StaffProfile identity linked to a user, or null if none. */
  findDoctorStaffByUserId(userId: string): Promise<VisitDoctorStaff | null>;

  /** Atomic intake: optional patient creation + unique code generation + visit creation, with retry. */
  createVisitWithOptionalPatient(command: CreateVisitCommand): Promise<unknown>;

  findManyPaginated(filter: VisitListFilter, skip: number, take: number): Promise<{ items: unknown[]; total: number }>;

  updateStatus(id: string, status: VisitStatus, completedAt?: Date, staffId?: string): Promise<unknown>;

  suggestDepartments(specialty: string): Promise<unknown[]>;
}

/** Detects a unique-constraint conflict on patientCode/visitCode/citizenId for retry. */
export function isUniqueVisitCodeConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    Array.isArray(error.meta?.target) &&
    ((error.meta.target as string[]).includes('patientCode') ||
      (error.meta.target as string[]).includes('visitCode') ||
      (error.meta.target as string[]).includes('citizenId'))
  );
}

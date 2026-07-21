import { Prisma, UserRole, UserStatus } from '@prisma/client';

/** DI token for the Staff repository port. */
export const STAFF_REPOSITORY = Symbol('STAFF_REPOSITORY');

export type StaffListFilter = {
  employeeCode?: string;
  fullName?: string;
  citizenId?: string;
  department?: string;
  /** Exact department UUID; preferred over the name-contains `department` filter when both are set. */
  departmentId?: string;
  role?: UserRole;
  /** Exclude one account role from the result set, used by UI pages that split doctors into a dedicated module. */
  excludeRole?: UserRole;
  /** When true, only include staff that head a department (StaffProfile.managedDepartment != null). */
  isManager?: boolean;
  search?: string;
  status?: UserStatus;
  includeDeleted?: boolean;
};

export type CreateStaffData = {
  username: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  employeeCode: string;
  fullName: string;
  phone: string;
  gender: string;
  citizenId: string;
  birthDate: string;
  address?: string;
  avatarUrl: string;
  departmentId?: string | null;
  position?: string;
};

export type UpdateStaffData = {
  username?: string;
  email?: string;
  role?: UserRole;
  status?: UserStatus;
  fullName?: string;
  phone?: string;
  gender?: string;
  citizenId?: string;
  birthDate?: string;
  address?: string;
  avatarUrl?: string;
  departmentId?: string | null;
  position?: string;
};

/**
 * Persistence boundary for the StaffProfile aggregate (and its linked User).
 * The Prisma implementation keeps include shapes, the create transaction,
 * uniqueness queries, and sanitization. Returned `user` objects are already
 * sanitized (passwordHash removed) to preserve the previous response shape.
 */
export interface StaffRepositoryPort {
  findByIdWithUserDoctor(id: string): Promise<any | null>;
  findByIdWithStaffRelations(id: string): Promise<any | null>;
  departmentExists(id: string): Promise<boolean>;
  findDepartment(id: string): Promise<{ id: string; type: string } | null>;

  findUserByUsernameOrEmail(username?: string, email?: string): Promise<{ id: string; username: string; email: string } | null>;
  findStaffByCitizenId(citizenId: string): Promise<{ id: string } | null>;
  findStaffByPhone(phone: string): Promise<{ id: string } | null>;
  findStaffByEmployeeCode(employeeCode: string): Promise<{ id: string } | null>;
  generateEmployeeCode(role: UserRole): Promise<string>;

  /** Atomic: create User + nested StaffProfile. Returns sanitized user incl. staffProfile. */
  createStaffUser(
    data: CreateStaffData,
    afterCreate?: (created: any, tx: Prisma.TransactionClient) => Promise<void>,
  ): Promise<any>;

  findManyPaginated(filter: StaffListFilter, skip: number, take: number): Promise<{ items: unknown[]; total: number }>;

  /** Update User (+ nested staffProfile). Returns sanitized user incl. staffProfile. */
  updateStaffUser(
    userId: string,
    data: UpdateStaffData,
    afterUpdate?: (updated: any, tx: Prisma.TransactionClient) => Promise<void>,
  ): Promise<any>;

  /** Update only the User status (+ bump tokenVersion). Returns sanitized user incl. staffProfile. */
  setUserStatus(
    userId: string,
    status: UserStatus,
    afterUpdate?: (updated: any, tx: Prisma.TransactionClient) => Promise<void>,
  ): Promise<any>;

  findAllOrdered(): Promise<any[]>;
}

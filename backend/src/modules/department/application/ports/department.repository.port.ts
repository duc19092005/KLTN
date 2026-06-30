import { DepartmentType, OperationalStatus, UserRole } from '@prisma/client';

/** DI token for the Department repository port. */
export const DEPARTMENT_REPOSITORY = Symbol('DEPARTMENT_REPOSITORY');

export type DepartmentListFilter = {
  search?: string;
  departmentCode?: string;
  name?: string;
  status?: OperationalStatus;
  type?: DepartmentType;
  canReceiveOrders?: boolean;
};

export type CreateDepartmentData = {
  departmentCode: string;
  name: string;
  floor?: string;
  status: OperationalStatus;
  type?: DepartmentType;
  canReceiveOrders: boolean;
  description?: string;
  managerId?: string | null;
};

export type UpdateDepartmentData = {
  departmentCode?: string;
  name?: string;
  floor?: string;
  status?: OperationalStatus;
  type?: DepartmentType;
  canReceiveOrders?: boolean;
  description?: string;
};

export type StaffProfileInfo = { id: string; departmentId: string | null; userRole?: UserRole };

/**
 * Persistence boundary for the Department aggregate. The Prisma implementation
 * keeps the include shapes, uniqueness queries, the create transaction (with
 * inline manager assignment), and the BlockchainLogger FK-detach on delete.
 */
export interface DepartmentRepositoryPort {
  findById(id: string): Promise<any | null>;
  findByIdOrThrow(id: string): Promise<any>;
  findByName(name: string): Promise<{ id: string } | null>;
  findByDepartmentCode(code: string): Promise<{ id: string } | null>;
  findStaffById(id: string): Promise<StaffProfileInfo | null>;
  findDepartmentByManagerId(managerId: string): Promise<{ id: string } | null>;
  countStaff(departmentId: string): Promise<number>;

  /** Atomic: create department + optionally assign manager's departmentId. */
  createWithManager(data: CreateDepartmentData): Promise<any>;

  findManyPaginated(filter: DepartmentListFilter, skip: number, take: number): Promise<{ items: unknown[]; total: number }>;

  update(id: string, data: UpdateDepartmentData): Promise<any>;
  assignManager(id: string, managerId: string | null): Promise<any>;
  setStaffDepartment(staffId: string, departmentId: string): Promise<void>;

  /** Update the User role for a given userId. */
  updateUserRole(userId: string, role: UserRole): Promise<void>;

  /** Find staff with user info for role promotion. */
  findStaffWithUser(staffId: string): Promise<{ id: string; userId: string; user: { id: string; role: UserRole } } | null>;

  /** Detach BlockchainLogger FK rows then delete the department. */
  deleteWithLogDetach(id: string): Promise<void>;

  findAllOrdered(): Promise<any[]>;
}

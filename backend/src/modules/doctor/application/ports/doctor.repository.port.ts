import { MedicalSpecialty, Prisma, UserStatus } from '@prisma/client';
import { CreateDoctorDto, CreateDoctorWithStaffDto, UpdateDoctorDto } from '../../dto/doctor.dto';

/** DI token for the Doctor repository port. */
export const DOCTOR_REPOSITORY = Symbol('DOCTOR_REPOSITORY');

export type DoctorListFilter = {
  specialty?: MedicalSpecialty;
  search?: string;
  includeDeleted?: boolean;
  status?: UserStatus;
};

export type StaffForDoctorCreate = {
  id: string;
  userRole: string;
  hasDoctorProfile: boolean;
  departmentId: string | null;
};

export type DoctorWriteHook = (doctor: any, tx: Prisma.TransactionClient) => Promise<void>;

/**
 * Persistence boundary for the DoctorProfile aggregate. The Prisma
 * implementation keeps the include shapes, code generation, and the multi-step
 * transactions (createWithStaff, update with nested staff) intact.
 */
export interface DoctorRepositoryPort {
  findByIdWithRelations(id: string): Promise<any | null>;
  findStaffForDoctorCreate(staffProfileId: string): Promise<StaffForDoctorCreate | null>;
  departmentExists(id: string): Promise<boolean>;
  findDepartment(id: string): Promise<{ id: string; type: string } | null>;

  findDoctorByLicense(licenseNumber: string): Promise<{ id: string } | null>;
  findStaffByCitizenId(citizenId: string): Promise<{ id: string } | null>;
  findUserByUsernameOrEmail(username: string, email: string): Promise<{ id: string } | null>;
  findStaffByEmployeeCode(employeeCode: string): Promise<{ id: string } | null>;
  generateEmployeeCode(): Promise<string>;

  /** Create a DoctorProfile for an existing DOCTOR staff. */
  createForExistingStaff(dto: CreateDoctorDto, afterWrite?: DoctorWriteHook): Promise<any>;

  /** Atomic: create user + staff + doctor profile. */
  createWithStaff(
    dto: CreateDoctorWithStaffDto,
    employeeCode: string,
    passwordHash: string,
    afterWrite?: DoctorWriteHook,
  ): Promise<any>;

  findManyPaginated(filter: DoctorListFilter, skip: number, take: number): Promise<{ items: unknown[]; total: number }>;

  /** Atomic: update doctor (+ nested staff). */
  updateWithRoom(id: string, dto: UpdateDoctorDto, afterWrite?: DoctorWriteHook): Promise<any>;

  findByStaffProfileId(staffProfileId: string): Promise<any | null>;
  findAllWithRelations(): Promise<any[]>;
}

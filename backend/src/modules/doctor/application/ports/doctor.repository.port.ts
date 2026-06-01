import { CreateDoctorDto, CreateDoctorWithStaffDto, UpdateDoctorDto } from '../../dto/doctor.dto';

/** DI token for the Doctor repository port. */
export const DOCTOR_REPOSITORY = Symbol('DOCTOR_REPOSITORY');

export type DoctorListFilter = {
  specialty?: string;
  search?: string;
};

export type StaffForDoctorCreate = {
  id: string;
  userRole: string;
  hasDoctorProfile: boolean;
};

/**
 * Persistence boundary for the DoctorProfile aggregate. The Prisma
 * implementation keeps the include shapes, code generation, and the multi-step
 * transactions (createWithStaff, update with clinical-room reassignment) intact.
 */
export interface DoctorRepositoryPort {
  findByIdWithRelations(id: string): Promise<any | null>;
  findStaffForDoctorCreate(staffProfileId: string): Promise<StaffForDoctorCreate | null>;
  departmentExists(id: string): Promise<boolean>;
  roomExists(id: string): Promise<boolean>;

  findDoctorByLicense(licenseNumber: string): Promise<{ id: string } | null>;
  findStaffByCitizenId(citizenId: string): Promise<{ id: string } | null>;
  findUserByUsernameOrEmail(username: string, email: string): Promise<{ id: string } | null>;
  findStaffByEmployeeCode(employeeCode: string): Promise<{ id: string } | null>;
  generateEmployeeCode(): Promise<string>;

  /** Create a DoctorProfile for an existing DOCTOR staff. */
  createForExistingStaff(dto: CreateDoctorDto): Promise<any>;

  /** Atomic: create user + staff + doctor profile + optional room assignment. */
  createWithStaff(dto: CreateDoctorWithStaffDto, employeeCode: string, passwordHash: string): Promise<any>;

  findManyPaginated(filter: DoctorListFilter, skip: number, take: number): Promise<{ items: unknown[]; total: number }>;

  /** Atomic: update doctor (+ nested staff) and reassign clinical room. */
  updateWithRoom(id: string, dto: UpdateDoctorDto): Promise<any>;

  /** Atomic: reassign/clear a doctor's clinical room. */
  assignRoom(id: string, clinicalRoomId?: string): Promise<void>;

  findByStaffProfileId(staffProfileId: string): Promise<any | null>;
  findAllWithRelations(): Promise<any[]>;
}

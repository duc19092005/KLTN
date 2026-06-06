/** DI token for the Patient repository port. */
export const PATIENT_REPOSITORY = Symbol('PATIENT_REPOSITORY');

export type PatientListFilter = {
  citizenId?: string;
  phone?: string;
  search?: string;
};

export type PatientWriteData = {
  patientCode?: string;
  fullName?: string;
  gender?: string;
  birthDate?: string;
  citizenId?: string;
  phone?: string;
  address?: string;
  insuranceNumber?: string;
  emergencyContact?: string;
};

/**
 * Persistence boundary for the Patient aggregate. The Prisma implementation
 * keeps the include shapes (recent visits), the field-mapping/normalization, and
 * patient-code generation from the former PatientService.
 */
export interface PatientRepositoryPort {
  findByIdWithRelations(id: string): Promise<any | null>;
  findByPatientCode(patientCode: string): Promise<any | null>;
  generatePatientCode(): Promise<string>;
  create(data: PatientWriteData, patientCode: string): Promise<any>;
  findManyPaginated(filter: PatientListFilter, skip: number, take: number): Promise<{ items: unknown[]; total: number }>;
  update(id: string, data: PatientWriteData): Promise<any>;
}

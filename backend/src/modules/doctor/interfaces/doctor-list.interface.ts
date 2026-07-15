import { DoctorEntity } from '../entities/doctor.entity';

export interface DoctorListResult {
  items: DoctorEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

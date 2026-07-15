import { DepartmentEntity } from '../entities/department.entity';

export interface DepartmentListResult {
  items: DepartmentEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

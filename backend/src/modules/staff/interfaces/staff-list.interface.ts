import { StaffEntity } from '../entities/staff.entity';

export interface StaffListResult {
  items: StaffEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

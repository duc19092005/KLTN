import { ClinicalRoomEntity } from '../entities/clinical-room.entity';

export interface ClinicalRoomListResult {
  items: ClinicalRoomEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

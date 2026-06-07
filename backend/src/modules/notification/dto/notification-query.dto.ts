import { IsBooleanString, IsDateString, IsOptional } from 'class-validator';

/**
 * Query filters for listing a user's notifications.
 * - isRead: 'true' | 'false' (string from query string) to filter by read state.
 * - from / to: ISO date strings to bound createdAt (inclusive day range).
 */
export class NotificationQueryDto {
  @IsOptional()
  @IsBooleanString()
  isRead?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

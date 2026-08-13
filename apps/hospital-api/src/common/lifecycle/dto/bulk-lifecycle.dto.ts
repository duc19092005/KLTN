import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

/**
 * DTO for bulk lifecycle operations (soft-delete, restore, permanent-delete).
 * Each operation processes ids independently so one failure never blocks others.
 */
export class BulkLifecycleDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  ids!: string[];
}

import { IsArray, IsNotEmpty, IsString, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class SurgicalRestoreItemDto {
  @ApiProperty({ description: 'Entity label as stored in BlockchainLogger (e.g. Patient, Department)' })
  @IsString()
  @IsNotEmpty()
  entity: string;

  @ApiProperty({ description: 'Affected record id' })
  @IsString()
  @IsNotEmpty()
  entityId: string;
}

export class SurgicalRestoreDto {
  @ApiProperty({ type: [SurgicalRestoreItemDto], description: 'Tampered records to restore from their anchored snapshot' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SurgicalRestoreItemDto)
  items: SurgicalRestoreItemDto[];
}

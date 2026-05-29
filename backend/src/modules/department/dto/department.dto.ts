import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DepartmentType } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationQueryDto } from '../../shared/pagination.dto';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'PB-XRAY', maxLength: 32 })
  @IsString()
  @MaxLength(32)
  departmentCode!: string;

  @ApiProperty({ example: 'Cardiology', maxLength: 120 })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: '2' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  floor?: string;

  @ApiPropertyOptional({ example: 'ACTIVE' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  status?: string;

  @ApiPropertyOptional({ enum: DepartmentType, example: DepartmentType.CLINICAL })
  @IsOptional()
  @IsEnum(DepartmentType)
  type?: DepartmentType;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  canReceiveOrders?: boolean;

  @ApiPropertyOptional({ example: 'Heart and vascular disease department' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '0d82b56f-5d0a-4501-bd18-bb9af91e90d7' })
  @IsOptional()
  @IsString()
  @IsUUID()
  managerId?: string;
}

export class UpdateDepartmentDto {
  @ApiPropertyOptional({ example: 'PB-XRAY', maxLength: 32 })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  departmentCode?: string;

  @ApiPropertyOptional({ example: 'Cardiology', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: '2' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  floor?: string;

  @ApiPropertyOptional({ example: 'ACTIVE' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  status?: string;

  @ApiPropertyOptional({ enum: DepartmentType, example: DepartmentType.CLINICAL })
  @IsOptional()
  @IsEnum(DepartmentType)
  type?: DepartmentType;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  canReceiveOrders?: boolean;

  @ApiPropertyOptional({ example: 'Updated department description' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class AssignManagerDto {
  @ApiPropertyOptional({ example: '0d82b56f-5d0a-4501-bd18-bb9af91e90d7', nullable: true })
  @IsOptional()
  @IsString()
  @IsUUID()
  managerId?: string;
}

export class DepartmentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'PB-XRAY' })
  @IsOptional()
  @IsString()
  departmentCode?: string;

  @ApiPropertyOptional({ example: 'Cardiology' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'ACTIVE' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ enum: DepartmentType, example: DepartmentType.LABORATORY })
  @IsOptional()
  @IsEnum(DepartmentType)
  type?: DepartmentType;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  canReceiveOrders?: boolean;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DepartmentType, OperationalStatus } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationQueryDto } from '../../shared/pagination.dto';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'PB-XRAY', minLength: 2, maxLength: 20, description: 'Mã phòng ban chỉ gồm chữ in hoa, số và dấu gạch ngang' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  @Matches(/^[A-Z0-9-]+$/, { message: 'Mã phòng ban chỉ được chứa chữ in hoa, số và dấu gạch ngang.' })
  departmentCode!: string;

  @ApiProperty({ example: 'Phòng khám tổng quát', minLength: 2, maxLength: 100 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[\p{L}\p{N}\s/&().,-]+$/u, { message: 'Tên phòng ban chứa ký tự không hợp lệ.' })
  name!: string;

  @ApiPropertyOptional({ example: '2', maxLength: 2, description: 'Tầng là số từ 0 đến 99, không nhập chữ' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(2)
  @Matches(/^\d{1,2}$/, { message: 'Tầng chỉ được nhập số từ 0 đến 99.' })
  floor?: string;

  @ApiPropertyOptional({ enum: OperationalStatus, example: OperationalStatus.ACTIVE })
  @IsOptional()
  @IsEnum(OperationalStatus)
  status?: OperationalStatus;

  @ApiPropertyOptional({ enum: DepartmentType, example: DepartmentType.CLINICAL })
  @IsOptional()
  @IsEnum(DepartmentType)
  type?: DepartmentType;



  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  canReceiveOrders?: boolean;

  @ApiPropertyOptional({ example: 'Heart and vascular disease department', maxLength: 500 })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: '0d82b56f-5d0a-4501-bd18-bb9af91e90d7' })
  @IsOptional()
  @IsString()
  @IsUUID()
  managerId?: string;
}

export class UpdateDepartmentDto {
  @ApiPropertyOptional({ example: 'PB-XRAY', minLength: 2, maxLength: 20, description: 'Mã phòng ban chỉ gồm chữ in hoa, số và dấu gạch ngang' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  @Matches(/^[A-Z0-9-]+$/, { message: 'Mã phòng ban chỉ được chứa chữ in hoa, số và dấu gạch ngang.' })
  departmentCode?: string;

  @ApiPropertyOptional({ example: 'Phòng khám tổng quát', minLength: 2, maxLength: 100 })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[\p{L}\p{N}\s/&().,-]+$/u, { message: 'Tên phòng ban chứa ký tự không hợp lệ.' })
  name?: string;

  @ApiPropertyOptional({ example: '2', maxLength: 2, description: 'Tầng là số từ 0 đến 99, không nhập chữ' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(2)
  @Matches(/^\d{1,2}$/, { message: 'Tầng chỉ được nhập số từ 0 đến 99.' })
  floor?: string;

  @ApiPropertyOptional({ enum: OperationalStatus, example: OperationalStatus.ACTIVE })
  @IsOptional()
  @IsEnum(OperationalStatus)
  status?: OperationalStatus;

  @ApiPropertyOptional({ enum: DepartmentType, example: DepartmentType.CLINICAL })
  @IsOptional()
  @IsEnum(DepartmentType)
  type?: DepartmentType;



  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  canReceiveOrders?: boolean;

  @ApiPropertyOptional({ example: 'Updated department description', maxLength: 500 })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500)
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

  @ApiPropertyOptional({ enum: OperationalStatus, example: OperationalStatus.ACTIVE })
  @IsOptional()
  @IsEnum(OperationalStatus)
  status?: OperationalStatus;

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

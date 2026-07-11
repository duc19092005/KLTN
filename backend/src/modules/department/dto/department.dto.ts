import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DepartmentType, OperationalStatus } from '@prisma/client';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationQueryDto } from '../../shared/pagination.dto';

function normalizeDepartmentName(value: unknown): unknown {
  if (typeof value !== 'string') return value;

  return value
    .trim()
    .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
    .replace(/(?<![\p{L}\p{N}])-|-(?![\p{L}\p{N}])/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export class CreateDepartmentDto {
  @ApiProperty({ example: 'PB-XRAY', minLength: 2, maxLength: 10, description: 'Mã phòng ban chỉ gồm chữ in hoa, số và dấu gạch ngang' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(10)
  @Matches(/^[A-Z0-9-]+$/, { message: 'Mã phòng ban chỉ được chứa chữ in hoa, số và dấu gạch ngang.' })
  departmentCode!: string;

  @ApiProperty({ example: 'Phòng khám tổng quát', minLength: 2, maxLength: 50 })
  @Transform(({ value }) => normalizeDepartmentName(value))
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[\p{L}]+(?:[\s-]+[\p{L}]+)*(?:[\s-]+\d+)?$/u, { message: 'Tên phòng ban phải bắt đầu bằng chữ; cho phép khoảng trắng/dấu gạch ngang, số chỉ được đặt ở cuối, ví dụ: X-Ray hoặc Tổng quát 1.' })
  name!: string;

  @ApiProperty({ example: '2A', maxLength: 3, description: 'Tầng là mã chữ-số ngắn, ví dụ 2A, 2B, B1' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tầng.' })
  @MaxLength(3)
  @Matches(/^[A-Z0-9]{1,3}$/, { message: 'Tầng bắt buộc nhập, chỉ gồm chữ không dấu và số, tối đa 3 ký tự.' })
  floor!: string;

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
  @ApiPropertyOptional({ example: 'PB-XRAY', minLength: 2, maxLength: 10, description: 'Mã phòng ban chỉ gồm chữ in hoa, số và dấu gạch ngang' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(10)
  @Matches(/^[A-Z0-9-]+$/, { message: 'Mã phòng ban chỉ được chứa chữ in hoa, số và dấu gạch ngang.' })
  departmentCode?: string;

  @ApiPropertyOptional({ example: 'Phòng khám tổng quát', minLength: 2, maxLength: 50 })
  @IsOptional()
  @Transform(({ value }) => normalizeDepartmentName(value))
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[\p{L}]+(?:[\s-]+[\p{L}]+)*(?:[\s-]+\d+)?$/u, { message: 'Tên phòng ban phải bắt đầu bằng chữ; cho phép khoảng trắng/dấu gạch ngang, số chỉ được đặt ở cuối, ví dụ: X-Ray hoặc Tổng quát 1.' })
  name?: string;

  @ApiPropertyOptional({ example: '2A', maxLength: 3, description: 'Tầng là mã chữ-số ngắn, ví dụ 2A, 2B, B1' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @MaxLength(3)
  @Matches(/^[A-Z0-9]{1,3}$/, { message: 'Tầng chỉ được nhập chữ không dấu và số, tối đa 3 ký tự.' })
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

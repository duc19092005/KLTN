import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { UserRole, UserStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../shared/pagination.dto';

export class CreateStaffDto {
  @ApiProperty({ example: 'doctor.nguyen' })
  @IsString() username!: string;

  @ApiProperty({ example: 'doctor.nguyen@hospital.local' })
  @IsEmail() email!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.LAB_MANAGER })
  @IsEnum(UserRole) role!: UserRole;

  @ApiProperty({ example: 'Nguyen Van A', maxLength: 160 })
  @IsString() @MaxLength(160) fullName!: string;

  @ApiProperty({ example: '0909123456' })
  @IsString() phone!: string;

  @ApiProperty({ example: 'MALE' })
  @IsString() gender!: string;

  @ApiProperty({ example: '012345678901' })
  @IsString() citizenId!: string;

  @ApiProperty({ example: '1988-01-20' })
  @IsDateString() birthDate!: string;

  @ApiPropertyOptional({ example: 'Ho Chi Minh City' })
  @IsOptional() @IsString() address?: string;

  @ApiProperty({ example: 'https://cdn.hospital.local/avatars/doctor-nguyen.jpg' })
  @IsString() @IsNotEmpty() @MaxLength(500) avatarUrl!: string;

  @ApiPropertyOptional({ example: 'BS-0001' })
  @IsOptional() @IsString() employeeCode?: string;

  @ApiPropertyOptional({ example: '0d82b56f-5d0a-4501-bd18-bb9af91e90d7' })
  @IsOptional() @IsString() @IsUUID() departmentId?: string;

  @ApiPropertyOptional({ example: 'Senior Doctor' })
  @IsOptional() @IsString() position?: string;
}

export class UpdateStaffDto {
  @ApiPropertyOptional({ example: 'doctor.nguyen' })
  @IsOptional() @IsString() username?: string;

  @ApiPropertyOptional({ example: 'doctor.nguyen@hospital.local' })
  @IsOptional() @IsEmail() email?: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional() @IsEnum(UserRole) role?: UserRole;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional() @IsEnum(UserStatus) status?: UserStatus;

  @ApiPropertyOptional({ example: 'Nguyen Van A' })
  @IsOptional() @IsString() fullName?: string;

  @ApiPropertyOptional({ example: '0909123456' })
  @IsOptional() @IsString() phone?: string;

  @ApiPropertyOptional({ example: 'MALE' })
  @IsOptional() @IsString() gender?: string;

  @ApiPropertyOptional({ example: '012345678901' })
  @IsOptional() @IsString() citizenId?: string;

  @ApiPropertyOptional({ example: '1988-01-20' })
  @IsOptional() @IsDateString() birthDate?: string;

  @ApiPropertyOptional({ example: 'Ho Chi Minh City' })
  @IsOptional() @IsString() address?: string;

  @ApiPropertyOptional({ example: 'https://cdn.hospital.local/avatars/doctor-nguyen.jpg' })
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(500) avatarUrl?: string;

  @ApiPropertyOptional({ example: '0d82b56f-5d0a-4501-bd18-bb9af91e90d7', nullable: true })
  @IsOptional() @IsString() @IsUUID() departmentId?: string;

  @ApiPropertyOptional({ example: 'Senior Doctor' })
  @IsOptional() @IsString() position?: string;
}

export class StaffQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'BS-0001' })
  @IsOptional() @IsString() employeeCode?: string;

  @ApiPropertyOptional({ example: 'Nguyen' })
  @IsOptional() @IsString() fullName?: string;

  @ApiPropertyOptional({ example: '012345678901' })
  @IsOptional() @IsString() citizenId?: string;

  @ApiPropertyOptional({ example: 'Cardiology' })
  @IsOptional() @IsString() department?: string;

  @ApiPropertyOptional({ example: '0d82b56f-5d0a-4501-bd18-bb9af91e90d7', description: 'Exact department UUID filter' })
  @IsOptional() @IsString() @IsUUID() departmentId?: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional() @IsEnum(UserRole) role?: UserRole;

  @ApiPropertyOptional({ enum: UserRole, description: 'Exclude this role from the staff list' })
  @IsOptional() @IsEnum(UserRole) excludeRole?: UserRole;

  @ApiPropertyOptional({ example: true, description: 'When true, only staff heading a department' })
  @IsOptional() @Transform(({ value }) => value === true || value === 'true') @IsBoolean() isManager?: boolean;
}

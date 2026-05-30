import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { PaginationQueryDto } from '../../shared/pagination.dto';

export class CreateDoctorDto {
  @ApiProperty({ example: '0d82b56f-5d0a-4501-bd18-bb9af91e90d7' })
  @IsString() @IsUUID() staffProfileId!: string;

  @ApiProperty({ example: 'Cardiology' })
  @IsString() specialty!: string;

  @ApiProperty({ example: 'VN-MOH-123456' })
  @IsString() licenseNumber!: string;

  @ApiProperty({ example: 'MD, PhD' })
  @IsString() qualification!: string;

  @ApiPropertyOptional({ example: 10, minimum: 0 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) yearsExperience?: number;
}

export class CreateDoctorWithStaffDto {
  @ApiProperty({ example: 'doctor.nguyen' })
  @IsString() username!: string;

  @ApiProperty({ example: 'doctor.nguyen@hospital.local' })
  @IsEmail() email!: string;

  @ApiProperty({ example: 'Nguyen Van A', maxLength: 160 })
  @IsString() @MaxLength(160) fullName!: string;

  @ApiProperty({ example: '0909123456' })
  @IsString() phone!: string;

  @ApiProperty({ example: 'Nam' })
  @IsString() gender!: string;

  @ApiProperty({ example: '012345678901' })
  @IsString() citizenId!: string;

  @ApiProperty({ example: '1988-01-20' })
  @IsDateString() birthDate!: string;

  @ApiPropertyOptional({ example: 'Ho Chi Minh City' })
  @IsOptional() @IsString() address?: string;

  @ApiProperty({ example: 'https://cdn.hospital.local/avatars/doctor-nguyen.jpg' })
  @IsString() @IsNotEmpty() @MaxLength(500) avatarUrl!: string;

  @ApiPropertyOptional({ example: '0d82b56f-5d0a-4501-bd18-bb9af91e90d7' })
  @IsOptional() @IsString() @IsUUID() departmentId?: string;

  @ApiPropertyOptional({ example: 'Senior Doctor' })
  @IsOptional() @IsString() position?: string;

  @ApiProperty({ example: 'Cardiology' })
  @IsString() specialty!: string;

  @ApiProperty({ example: 'VN-MOH-123456' })
  @IsString() licenseNumber!: string;

  @ApiProperty({ example: 'MD, PhD' })
  @IsString() qualification!: string;

  @ApiPropertyOptional({ example: 10, minimum: 0 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) yearsExperience?: number;

  @ApiPropertyOptional({ example: '0d82b56f-5d0a-4501-bd18-bb9af91e90d7' })
  @IsOptional() @IsString() @IsUUID() clinicalRoomId?: string;
}

export class UpdateDoctorDto {
  @ApiPropertyOptional({ example: 'Neurology' })
  @IsOptional() @IsString() specialty?: string;

  @ApiPropertyOptional({ example: 'VN-MOH-654321' })
  @IsOptional() @IsString() licenseNumber?: string;

  @ApiPropertyOptional({ example: 'Specialist Level II' })
  @IsOptional() @IsString() qualification?: string;

  @ApiPropertyOptional({ example: 12, minimum: 0 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) yearsExperience?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString() fullName?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() phone?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() citizenId?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() gender?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() address?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() avatarUrl?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @IsUUID() departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() position?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsDateString() birthDate?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @IsUUID() clinicalRoomId?: string;
}

export class AssignClinicalRoomDto {
  @ApiPropertyOptional({ example: '0d82b56f-5d0a-4501-bd18-bb9af91e90d7', nullable: true })
  @IsOptional() @IsString() @IsUUID() clinicalRoomId?: string;
}

export class DoctorQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'Cardiology' })
  @IsOptional() @IsString() specialty?: string;
}

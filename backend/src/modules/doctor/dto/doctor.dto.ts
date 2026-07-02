import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MedicalSpecialty } from '@prisma/client';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { PaginationQueryDto } from '../../shared/pagination.dto';

function sanitizeMedicalLicense(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return value.replace(/\s+/g, '').trim().toUpperCase();
}

function getMedicalLicenseError(value: unknown): string {
  const license = typeof value === 'string' ? value : '';
  if (!license) return 'Vui lòng nhập số Giấy phép / Chứng chỉ hành nghề.';
  if ((license.match(/\//g) || []).length !== 1 || (license.match(/-/g) || []).length !== 1) {
    return "Định dạng không hợp lệ. Số giấy phép phải có dấu '/' và '-' (Ví dụ: 030856/HCM-CCHN).";
  }
  const slashIndex = license.indexOf('/');
  const dashIndex = license.indexOf('-');
  const personalCode = license.slice(0, slashIndex);
  const issuerCode = license.slice(slashIndex + 1, dashIndex);
  const licenseType = license.slice(dashIndex + 1);
  if (!/^\d{6}$/.test(personalCode)) return 'Mã định danh phải bao gồm đúng 6 chữ số.';
  if (!/^[A-Z]{2,4}$/.test(issuerCode)) return 'Mã nơi cấp phải gồm 2 đến 4 chữ cái in hoa.';
  if (!['CCHN', 'GPHN'].includes(licenseType)) {
    return 'Mã loại giấy phép không hợp lệ. Phần cuối phải là -CCHN hoặc -GPHN.';
  }
  if (license.length < 13 || license.length > 16) {
    return 'Số Giấy phép / Chứng chỉ hành nghề phải có độ dài từ 13 đến 16 ký tự.';
  }
  return '';
}

@ValidatorConstraint({ name: 'medicalLicenseNumber', async: false })
class MedicalLicenseNumberConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return getMedicalLicenseError(value) === '';
  }

  defaultMessage(args: ValidationArguments): string {
    return getMedicalLicenseError(args.value);
  }
}

export class CreateDoctorDto {
  @ApiProperty({ example: '0d82b56f-5d0a-4501-bd18-bb9af91e90d7' })
  @IsString() @IsUUID() staffProfileId!: string;

  @ApiProperty({ enum: MedicalSpecialty, example: MedicalSpecialty.CARDIOLOGY })
  @IsEnum(MedicalSpecialty) specialty!: MedicalSpecialty;

  @ApiProperty({ example: '030856/HCM-CCHN' })
  @Transform(({ value }) => sanitizeMedicalLicense(value))
  @IsString()
  @Validate(MedicalLicenseNumberConstraint)
  licenseNumber!: string;

  @ApiProperty({ example: 'MD, PhD' })
  @IsString() qualification!: string;

  @ApiPropertyOptional({ example: 10, minimum: 1, maximum: 50 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1, { message: 'Số năm kinh nghiệm phải từ 1 đến 50.' }) @Max(50, { message: 'Số năm kinh nghiệm phải từ 1 đến 50.' }) yearsExperience?: number;
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

  @ApiProperty({ enum: MedicalSpecialty, example: MedicalSpecialty.CARDIOLOGY })
  @IsEnum(MedicalSpecialty) specialty!: MedicalSpecialty;

  @ApiProperty({ example: '030856/HCM-CCHN' })
  @Transform(({ value }) => sanitizeMedicalLicense(value))
  @IsString()
  @Validate(MedicalLicenseNumberConstraint)
  licenseNumber!: string;

  @ApiProperty({ example: 'MD, PhD' })
  @IsString() qualification!: string;

  @ApiPropertyOptional({ example: 10, minimum: 1, maximum: 50 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1, { message: 'Số năm kinh nghiệm phải từ 1 đến 50.' }) @Max(50, { message: 'Số năm kinh nghiệm phải từ 1 đến 50.' }) yearsExperience?: number;
}

export class UpdateDoctorDto {
  @ApiPropertyOptional({ enum: MedicalSpecialty, example: MedicalSpecialty.NEUROLOGY })
  @IsOptional() @IsEnum(MedicalSpecialty) specialty?: MedicalSpecialty;

  @ApiPropertyOptional({ example: '030856/HCM-GPHN' })
  @IsOptional()
  @Transform(({ value }) => sanitizeMedicalLicense(value))
  @IsString()
  @Validate(MedicalLicenseNumberConstraint)
  licenseNumber?: string;

  @ApiPropertyOptional({ example: 'Specialist Level II' })
  @IsOptional() @IsString() qualification?: string;

  @ApiPropertyOptional({ example: 12, minimum: 1, maximum: 50 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1, { message: 'Số năm kinh nghiệm phải từ 1 đến 50.' }) @Max(50, { message: 'Số năm kinh nghiệm phải từ 1 đến 50.' }) yearsExperience?: number;

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
}

export class DoctorQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: MedicalSpecialty, example: MedicalSpecialty.CARDIOLOGY })
  @IsOptional() @IsEnum(MedicalSpecialty) specialty?: MedicalSpecialty;
}

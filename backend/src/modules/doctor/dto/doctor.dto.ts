import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MedicalSpecialty } from '@prisma/client';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  Matches,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { PaginationQueryDto } from '../../shared/pagination.dto';

const MIN_BIRTH_YEAR = 1900;
const MAX_FULL_NAME_LENGTH = 80;
const MAX_USERNAME_LENGTH = 30;
const MAX_POSITION_LENGTH = 80;
const MAX_ADDRESS_LENGTH = 255;
const MAX_LICENSE_NUMBER_LENGTH = 30;
const MIN_YEARS_EXPERIENCE = 1;
const MAX_YEARS_EXPERIENCE = 50;
const VN_PHONE_REGEX = /^(0)(3[2-9]|5[2689]|7[06-9]|8[1-689]|9[0-46-9])\d{7}$/;
const VN_CITIZEN_ID_REGEX = /^\d{12}$/;
const VIETNAMESE_NAME_REGEX = /^[A-Za-zÀ-ỹ\s]+$/;
const USERNAME_REGEX = /^[a-z0-9]+$/;
const EMAIL_REGEX = /^[a-z0-9]+(?:[._-][a-z0-9]+)*@[a-z0-9]+(?:[-.][a-z0-9]+)*\.[a-z]{2,}$/;
const GENDER_VALUES = ['Nam', 'Nữ'] as const;

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function getBirthDateError(value: unknown): string {
  if (typeof value !== 'string' || !value) return 'Ngày sinh phải đúng định dạng ngày hợp lệ.';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.slice(0, 10));
  if (!match) return 'Ngày sinh phải đúng định dạng ngày hợp lệ.';
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (year < MIN_BIRTH_YEAR) return `Ngày sinh phải từ năm ${MIN_BIRTH_YEAR}.`;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return 'Ngày sinh phải đúng định dạng ngày hợp lệ.';
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date <= today ? '' : 'Ngày sinh không được lớn hơn hôm nay.';
}

@ValidatorConstraint({ name: 'birthDateRange', async: false })
class BirthDateRangeConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return getBirthDateError(value) === '';
  }

  defaultMessage(args: ValidationArguments): string {
    return getBirthDateError(args.value);
  }
}

export class CreateDoctorDto {
  @ApiProperty({ example: '0d82b56f-5d0a-4501-bd18-bb9af91e90d7' })
  @IsString() @IsUUID() staffProfileId!: string;

  @ApiProperty({ enum: MedicalSpecialty, example: MedicalSpecialty.CARDIOLOGY })
  @IsEnum(MedicalSpecialty) specialty!: MedicalSpecialty;

  @ApiProperty({ example: '030856/HCM-CCHN', maxLength: MAX_LICENSE_NUMBER_LENGTH })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập số chứng chỉ.' })
  @MaxLength(MAX_LICENSE_NUMBER_LENGTH, { message: `Số chứng chỉ không được vượt quá ${MAX_LICENSE_NUMBER_LENGTH} ký tự.` })
  licenseNumber!: string;

  @ApiProperty({ example: 'MD, PhD' })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn trình độ.' })
  qualification!: string;

  @ApiPropertyOptional({ example: 10, minimum: MIN_YEARS_EXPERIENCE, maximum: MAX_YEARS_EXPERIENCE })
  @IsOptional() @Type(() => Number) @IsInt() @Min(MIN_YEARS_EXPERIENCE, { message: `Số năm kinh nghiệm phải từ ${MIN_YEARS_EXPERIENCE} đến ${MAX_YEARS_EXPERIENCE}.` }) @Max(MAX_YEARS_EXPERIENCE, { message: `Số năm kinh nghiệm phải từ ${MIN_YEARS_EXPERIENCE} đến ${MAX_YEARS_EXPERIENCE}.` }) yearsExperience?: number;
}

export class CreateDoctorWithStaffDto {
  @ApiProperty({ example: 'doctornguyen01', maxLength: MAX_USERNAME_LENGTH })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên đăng nhập.' })
  @MaxLength(MAX_USERNAME_LENGTH, { message: `Tên đăng nhập không được vượt quá ${MAX_USERNAME_LENGTH} ký tự.` })
  @Matches(USERNAME_REGEX, { message: 'Tên đăng nhập chỉ gồm chữ thường không dấu và số.' })
  username!: string;

  @ApiProperty({ example: 'doctor.nguyen@hospital.local' })
  @IsEmail({}, { message: 'Email phải đúng định dạng.' })
  @Matches(EMAIL_REGEX, { message: 'Email phải đúng định dạng và không chứa dấu/ký tự đặc biệt lạ.' })
  email!: string;

  @ApiProperty({ example: 'Nguyễn Văn A', maxLength: MAX_FULL_NAME_LENGTH })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập họ tên.' })
  @MaxLength(MAX_FULL_NAME_LENGTH, { message: `Họ tên không được vượt quá ${MAX_FULL_NAME_LENGTH} ký tự.` })
  @Matches(VIETNAMESE_NAME_REGEX, { message: 'Họ tên chỉ được chứa chữ cái tiếng Việt và khoảng trắng.' })
  fullName!: string;

  @ApiProperty({ example: '0909123456' })
  @IsString()
  @Matches(VN_PHONE_REGEX, { message: 'Số điện thoại Việt Nam phải gồm 10 số và đúng đầu số.' })
  phone!: string;

  @ApiProperty({ example: 'Nam', enum: GENDER_VALUES })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn giới tính.' })
  @IsIn(GENDER_VALUES, { message: 'Giới tính chỉ được chọn Nam hoặc Nữ.' })
  gender!: string;

  @ApiProperty({ example: '012345678901' })
  @IsString()
  @Matches(VN_CITIZEN_ID_REGEX, { message: 'CCCD phải gồm đúng 12 chữ số.' })
  citizenId!: string;

  @ApiProperty({ example: '1988-01-20' })
  @IsDateString({}, { message: 'Ngày sinh phải đúng định dạng ngày hợp lệ.' })
  @Validate(BirthDateRangeConstraint)
  birthDate!: string;

  @ApiProperty({ example: 'Ho Chi Minh City', maxLength: MAX_ADDRESS_LENGTH })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập địa chỉ.' })
  @MaxLength(MAX_ADDRESS_LENGTH, { message: `Địa chỉ không được vượt quá ${MAX_ADDRESS_LENGTH} ký tự.` })
  address!: string;

  @ApiProperty({ example: 'https://cdn.hospital.local/avatars/doctor-nguyen.jpg' })
  @IsString() @IsNotEmpty() @MaxLength(500) avatarUrl!: string;

  @ApiProperty({ example: '0d82b56f-5d0a-4501-bd18-bb9af91e90d7' })
  @IsString() @IsUUID() departmentId!: string;

  @ApiProperty({ example: 'Bác sĩ', maxLength: MAX_POSITION_LENGTH })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn chức danh.' })
  @MaxLength(MAX_POSITION_LENGTH, { message: `Chức danh không được vượt quá ${MAX_POSITION_LENGTH} ký tự.` })
  position!: string;

  @ApiProperty({ enum: MedicalSpecialty, example: MedicalSpecialty.CARDIOLOGY })
  @IsEnum(MedicalSpecialty) specialty!: MedicalSpecialty;

  @ApiProperty({ example: '030856/HCM-CCHN', maxLength: MAX_LICENSE_NUMBER_LENGTH })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập số chứng chỉ.' })
  @MaxLength(MAX_LICENSE_NUMBER_LENGTH, { message: `Số chứng chỉ không được vượt quá ${MAX_LICENSE_NUMBER_LENGTH} ký tự.` })
  licenseNumber!: string;

  @ApiProperty({ example: 'MD, PhD' })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn trình độ.' })
  qualification!: string;

  @ApiProperty({ example: 10, minimum: MIN_YEARS_EXPERIENCE, maximum: MAX_YEARS_EXPERIENCE })
  @Type(() => Number) @IsInt() @Min(MIN_YEARS_EXPERIENCE, { message: `Số năm kinh nghiệm phải từ ${MIN_YEARS_EXPERIENCE} đến ${MAX_YEARS_EXPERIENCE}.` }) @Max(MAX_YEARS_EXPERIENCE, { message: `Số năm kinh nghiệm phải từ ${MIN_YEARS_EXPERIENCE} đến ${MAX_YEARS_EXPERIENCE}.` }) yearsExperience!: number;
}

export class UpdateDoctorDto {
  @ApiPropertyOptional({ enum: MedicalSpecialty, example: MedicalSpecialty.NEUROLOGY })
  @IsOptional() @IsEnum(MedicalSpecialty) specialty?: MedicalSpecialty;

  @ApiPropertyOptional({ example: '030856/HCM-GPHN', maxLength: MAX_LICENSE_NUMBER_LENGTH })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập số chứng chỉ.' })
  @MaxLength(MAX_LICENSE_NUMBER_LENGTH, { message: `Số chứng chỉ không được vượt quá ${MAX_LICENSE_NUMBER_LENGTH} ký tự.` })
  licenseNumber?: string;

  @ApiPropertyOptional({ example: 'Specialist Level II' })
  @IsOptional() @IsString() @IsNotEmpty({ message: 'Vui lòng chọn trình độ.' }) qualification?: string;

  @ApiPropertyOptional({ example: 12, minimum: MIN_YEARS_EXPERIENCE, maximum: MAX_YEARS_EXPERIENCE })
  @IsOptional() @Type(() => Number) @IsInt() @Min(MIN_YEARS_EXPERIENCE, { message: `Số năm kinh nghiệm phải từ ${MIN_YEARS_EXPERIENCE} đến ${MAX_YEARS_EXPERIENCE}.` }) @Max(MAX_YEARS_EXPERIENCE, { message: `Số năm kinh nghiệm phải từ ${MIN_YEARS_EXPERIENCE} đến ${MAX_YEARS_EXPERIENCE}.` }) yearsExperience?: number;

  @ApiPropertyOptional({ maxLength: MAX_FULL_NAME_LENGTH })
  @IsOptional() @IsString() @MaxLength(MAX_FULL_NAME_LENGTH, { message: `Họ tên không được vượt quá ${MAX_FULL_NAME_LENGTH} ký tự.` }) @Matches(VIETNAMESE_NAME_REGEX, { message: 'Họ tên chỉ được chứa chữ cái tiếng Việt và khoảng trắng.' }) fullName?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @Matches(VN_PHONE_REGEX, { message: 'Số điện thoại Việt Nam phải gồm 10 số và đúng đầu số.' }) phone?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @Matches(VN_CITIZEN_ID_REGEX, { message: 'CCCD phải gồm đúng 12 chữ số.' }) citizenId?: string;

  @ApiPropertyOptional({ enum: GENDER_VALUES })
  @IsOptional() @IsString() @IsNotEmpty({ message: 'Vui lòng chọn giới tính.' }) @IsIn(GENDER_VALUES, { message: 'Giới tính chỉ được chọn Nam hoặc Nữ.' }) gender?: string;

  @ApiPropertyOptional({ maxLength: MAX_ADDRESS_LENGTH })
  @IsOptional() @IsString() @IsNotEmpty({ message: 'Vui lòng nhập địa chỉ.' }) @MaxLength(MAX_ADDRESS_LENGTH, { message: `Địa chỉ không được vượt quá ${MAX_ADDRESS_LENGTH} ký tự.` }) address?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(500) avatarUrl?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @IsUUID() departmentId?: string;

  @ApiPropertyOptional({ maxLength: MAX_POSITION_LENGTH })
  @IsOptional() @IsString() @IsNotEmpty({ message: 'Vui lòng chọn chức danh.' }) @MaxLength(MAX_POSITION_LENGTH, { message: `Chức danh không được vượt quá ${MAX_POSITION_LENGTH} ký tự.` }) position?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsDateString({}, { message: 'Ngày sinh phải đúng định dạng ngày hợp lệ.' }) @Validate(BirthDateRangeConstraint) birthDate?: string;
}

export class DoctorQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: MedicalSpecialty, example: MedicalSpecialty.CARDIOLOGY })
  @IsOptional() @IsEnum(MedicalSpecialty) specialty?: MedicalSpecialty;

  @ApiPropertyOptional({ example: true, description: 'Include soft-deleted doctors' })
  @IsOptional() @Transform(({ value }) => value === true || value === 'true') includeDeleted?: boolean;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEmail, IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { UserRole, UserStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../shared/pagination.dto';
const STAFF_GENDER_VALUES = ['Nam', 'Nữ'] as const;

export class CreateStaffDto {
  @ApiProperty({ example: 'nguyenvana01', maxLength: 30 })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên đăng nhập.' })
  @MaxLength(30, { message: 'Tên đăng nhập không được vượt quá 30 ký tự.' })
  @Matches(/^[a-z0-9]+$/, { message: 'Tên đăng nhập chỉ gồm chữ thường không dấu và số.' })
  username!: string;

  @ApiProperty({ example: 'nguyenvana@hospital.local' })
  @IsEmail({}, { message: 'Email phải đúng định dạng.' })
  @Matches(/^[a-z0-9]+(?:[._-][a-z0-9]+)*@[a-z0-9]+(?:[-.][a-z0-9]+)*\.[a-z]{2,}$/, { message: 'Email phải đúng định dạng và không chứa dấu/ký tự đặc biệt lạ.' })
  email!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.LAB_MANAGER })
  @IsEnum(UserRole) role!: UserRole;

  @ApiProperty({ example: 'Nguyễn Văn A', maxLength: 80 })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập họ tên.' })
  @MaxLength(80, { message: 'Họ tên không được vượt quá 80 ký tự.' })
  @Matches(/^[A-Za-zÀ-ỹ\s]+$/, { message: 'Họ tên chỉ được chứa chữ cái tiếng Việt và khoảng trắng.' })
  fullName!: string;

  @ApiProperty({ example: '0909123456' })
  @IsString()
  @Matches(/^(0)(3[2-9]|5[2689]|7[06-9]|8[1-689]|9[0-46-9])\d{7}$/, { message: 'Số điện thoại Việt Nam phải gồm 10 số và đúng đầu số.' })
  phone!: string;

  @ApiProperty({ example: 'Nam', enum: STAFF_GENDER_VALUES })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn giới tính.' })
  @IsIn(STAFF_GENDER_VALUES, { message: 'Giới tính chỉ được chọn Nam hoặc Nữ.' })
  gender!: string;

  @ApiProperty({ example: '012345678901' })
  @IsString()
  @Matches(/^\d{12}$/, { message: 'CCCD phải gồm đúng 12 chữ số.' })
  citizenId!: string;

  @ApiProperty({ example: '1988-01-20' })
  @IsDateString({}, { message: 'Ngày sinh phải đúng định dạng ngày hợp lệ.' })
  birthDate!: string;

  @ApiProperty({ example: 'Ho Chi Minh City', maxLength: 255 })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập địa chỉ.' })
  @MaxLength(255, { message: 'Địa chỉ không được vượt quá 255 ký tự.' })
  address!: string;

  @ApiProperty({ example: 'https://cdn.hospital.local/avatars/doctor-nguyen.jpg' })
  @IsString() @IsNotEmpty() @MaxLength(500) avatarUrl!: string;

  @ApiPropertyOptional({ example: 'BS-0001' })
  @IsOptional() @IsString() employeeCode?: string;

  @ApiPropertyOptional({ example: '0d82b56f-5d0a-4501-bd18-bb9af91e90d7' })
  @IsOptional() @IsString() @IsUUID() departmentId?: string;

  @ApiPropertyOptional({ example: 'KTV xét nghiệm', maxLength: 80 })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập chức danh.' })
  @MaxLength(80, { message: 'Chức danh không được vượt quá 80 ký tự.' })
  position!: string;
}

export class UpdateStaffDto {
  @ApiPropertyOptional({ example: 'nguyenvana01', maxLength: 30 })
  @IsOptional()
  @IsString()
  @MaxLength(30, { message: 'Tên đăng nhập không được vượt quá 30 ký tự.' })
  @Matches(/^[a-z0-9]+$/, { message: 'Tên đăng nhập chỉ gồm chữ thường không dấu và số.' })
  username?: string;

  @ApiPropertyOptional({ example: 'nguyenvana@hospital.local' })
  @IsOptional()
  @IsEmail({}, { message: 'Email phải đúng định dạng.' })
  @Matches(/^[a-z0-9]+(?:[._-][a-z0-9]+)*@[a-z0-9]+(?:[-.][a-z0-9]+)*\.[a-z]{2,}$/, { message: 'Email phải đúng định dạng và không chứa dấu/ký tự đặc biệt lạ.' })
  email?: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional() @IsEnum(UserRole) role?: UserRole;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional() @IsEnum(UserStatus) status?: UserStatus;

  @ApiPropertyOptional({ example: 'Nguyễn Văn A', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80, { message: 'Họ tên không được vượt quá 80 ký tự.' })
  @Matches(/^[A-Za-zÀ-ỹ\s]+$/, { message: 'Họ tên chỉ được chứa chữ cái tiếng Việt và khoảng trắng.' })
  fullName?: string;

  @ApiPropertyOptional({ example: '0909123456' })
  @IsOptional()
  @IsString()
  @Matches(/^(0)(3[2-9]|5[2689]|7[06-9]|8[1-689]|9[0-46-9])\d{7}$/, { message: 'Số điện thoại Việt Nam phải gồm 10 số và đúng đầu số.' })
  phone?: string;

  @ApiPropertyOptional({ enum: STAFF_GENDER_VALUES })
  @IsOptional() @IsString() @IsIn(STAFF_GENDER_VALUES, { message: 'Giới tính chỉ được chọn Nam hoặc Nữ.' }) gender?: string;

  @ApiPropertyOptional({ example: '012345678901' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{12}$/, { message: 'CCCD phải gồm đúng 12 chữ số.' })
  citizenId?: string;

  @ApiPropertyOptional({ example: '1988-01-20' })
  @IsOptional() @IsDateString({}, { message: 'Ngày sinh phải đúng định dạng ngày hợp lệ.' }) birthDate?: string;

  @ApiPropertyOptional({ example: 'Ho Chi Minh City', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Địa chỉ không được vượt quá 255 ký tự.' })
  address?: string;

  @ApiPropertyOptional({ example: 'https://cdn.hospital.local/avatars/doctor-nguyen.jpg' })
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(500) avatarUrl?: string;

  @ApiPropertyOptional({ example: '0d82b56f-5d0a-4501-bd18-bb9af91e90d7', nullable: true })
  @IsOptional() @IsString() @IsUUID() departmentId?: string;

  @ApiPropertyOptional({ example: 'KTV xét nghiệm', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80, { message: 'Chức danh không được vượt quá 80 ký tự.' })
  position?: string;
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

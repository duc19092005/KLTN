import { IsDateString, IsEmail, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { UserStatus } from '@prisma/client';

export class CreateStaffDto {
  @IsString()
  username!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MaxLength(160)
  fullName!: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsString()
  phone!: string;

  @IsString()
  gender!: string;

  @IsString()
  citizenId!: string;

  @IsDateString()
  birthDate!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  position?: string;

}

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  citizenId?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  position?: string;

}

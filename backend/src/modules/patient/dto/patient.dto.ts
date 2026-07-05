import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../shared/pagination.dto';
const PATIENT_GENDER_VALUES = ['MALE', 'FEMALE'] as const;

export class CreatePatientDto {
  @ApiPropertyOptional({ example: 'BN-0001' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  patientCode?: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  @IsString()
  @MaxLength(160)
  fullName!: string;

  @ApiProperty({ example: 'MALE', enum: PATIENT_GENDER_VALUES })
  @IsString()
  @IsIn(PATIENT_GENDER_VALUES, { message: 'Giới tính chỉ được chọn Nam hoặc Nữ.' })
  gender!: string;

  @ApiProperty({ example: '1990-01-01' })
  @IsDateString()
  birthDate!: string;

  @ApiPropertyOptional({ example: '012345678901' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  citizenId?: string;

  @ApiPropertyOptional({ example: '0909123456' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  insuranceNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  emergencyContact?: string;
}

export class UpdatePatientDto extends CreatePatientDto {}

export class PatientQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  citizenId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;
}

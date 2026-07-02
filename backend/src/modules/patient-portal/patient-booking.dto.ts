import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MedicalSpecialty } from '@prisma/client';
import { IsDateString, IsEnum, IsISO8601, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreatePatientProfileFromPortalDto {
  @ApiProperty({ example: 'Nguyễn Văn A' })
  @IsString()
  @MaxLength(160)
  fullName!: string;

  @ApiProperty({ example: 'MALE' })
  @IsString()
  @MaxLength(20)
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

export class CreateAppointmentDto {
  @ApiProperty({ example: 'patient-id' })
  @IsUUID()
  patientId!: string;

  @ApiProperty({ enum: MedicalSpecialty, example: MedicalSpecialty.CARDIOLOGY })
  @IsEnum(MedicalSpecialty)
  specialty!: MedicalSpecialty;

  @ApiProperty({ example: 'doctor-profile-id' })
  @IsUUID()
  doctorId!: string;

  @ApiProperty({ example: '2026-06-30T08:30:00.000Z' })
  @IsISO8601()
  scheduledAt!: string;

  @ApiPropertyOptional({ example: 'Khám đau ngực' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({ example: 'Đau ngực nhẹ khi vận động' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  symptoms?: string;
}

export class AppointmentSlotQueryDto {
  @ApiProperty({ example: '2026-06-30' })
  @IsDateString()
  date!: string;
}

export class AppointmentListQueryDto {
  @ApiPropertyOptional({ example: 'patient-id' })
  @IsOptional()
  @IsUUID()
  patientId?: string;
}

export class VerifyAppointmentQrDto {
  @ApiProperty({ example: 'KLTN_APPOINTMENT_CHECKIN:opaque-token' })
  @IsString()
  qrPayload!: string;
}

export class CheckInAppointmentDto extends VerifyAppointmentQrDto {
  @ApiPropertyOptional({ example: 'Khám theo lịch hẹn' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({ example: 'Bệnh nhân khai đau ngực nhẹ' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  symptoms?: string;
}

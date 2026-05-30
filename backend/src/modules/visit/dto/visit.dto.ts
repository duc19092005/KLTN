import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VisitStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../shared/pagination.dto';
import { CreatePatientDto } from '../../patient/dto/patient.dto';

export class CreateVisitDto {
  @ApiPropertyOptional({ description: 'Có patientId nếu là bệnh nhân cũ' })
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @ApiPropertyOptional({ description: 'Thông tin bệnh nhân mới nếu chưa có hồ sơ' })
  @IsOptional()
  patient?: CreatePatientDto;

  @ApiProperty({ example: 'clinical-room-id' })
  @IsUUID()
  clinicalRoomId!: string;

  @ApiProperty({ example: 'doctor-profile-id' })
  @IsUUID()
  doctorId!: string;
}

export class UpdateVisitStatusDto {
  @ApiProperty({ enum: VisitStatus })
  @IsEnum(VisitStatus)
  status!: VisitStatus;
}

export class VisitQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: VisitStatus })
  @IsOptional()
  @IsEnum(VisitStatus)
  status?: VisitStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  doctorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  clinicalRoomId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  patientId?: string;
}

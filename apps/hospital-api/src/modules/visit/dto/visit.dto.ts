import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VisitStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../shared/pagination.dto';
import { CreatePatientDto } from '../../patient/dto/patient.dto';

export class CreateVisitDto {
  @ApiPropertyOptional({ description: 'Có patientId nếu là bệnh nhân cũ' })
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @ApiPropertyOptional({ description: 'Thông tin bệnh nhân mới nếu chưa có hồ sơ' })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreatePatientDto)
  patient?: CreatePatientDto;

  @ApiProperty({ example: 'department-id' })
  @IsUUID()
  departmentId!: string;

  @ApiPropertyOptional({ description: 'Bác sĩ phụ trách được tự động chọn từ phòng khám' })
  @IsOptional()
  @IsUUID()
  staffId?: string;
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
  staffId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  patientId?: string;
}

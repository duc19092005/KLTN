import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MedicalOrderStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateMedicalOrderDto {
  @ApiProperty()
  @IsUUID()
  visitId!: string;

  @ApiPropertyOptional({ description: 'Khoa/phòng ban nhận chỉ định, ví dụ khoa xét nghiệm, chẩn đoán hình ảnh' })
  @IsOptional()
  @IsUUID()
  targetDepartmentId?: string;

  @ApiProperty({ example: 'Xét nghiệm máu tổng quát' })
  @IsString()
  @IsNotEmpty()
  orderType!: string;

  @ApiPropertyOptional({ example: 'NORMAL | URGENT | STAT' })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional({ example: 'Bệnh nhân sốt cao, nghi nhiễm trùng' })
  @IsOptional()
  @IsString()
  clinicalNote?: string;
}

export class MedicalOrderQueryDto {
  @ApiPropertyOptional({ enum: MedicalOrderStatus })
  @IsOptional()
  @IsEnum(MedicalOrderStatus)
  status?: MedicalOrderStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  visitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  targetDepartmentId?: string;
}

export class UpdateMedicalOrderStatusDto {
  @ApiProperty({ enum: MedicalOrderStatus })
  @IsEnum(MedicalOrderStatus)
  status!: MedicalOrderStatus;
}

export class CreateMedicalResultDto {
  @ApiProperty({ example: 'Bạch cầu tăng nhẹ, CRP tăng' })
  @IsString()
  @IsNotEmpty()
  resultSummary!: string;

  @ApiPropertyOptional({ description: 'Dữ liệu xét nghiệm dạng JSON: chỉ số, đơn vị, khoảng tham chiếu...' })
  @IsOptional()
  @IsObject()
  resultData?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  conclusion?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MedicalOrderStatus } from '@prisma/client';
import { IsArray, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

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

export class MedicalResultFileDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  originalName!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  mimeType!: string;

  @ApiProperty()
  @IsNumber()
  size!: number;

  @ApiPropertyOptional({ description: 'Legacy public/provider URL for pre-S3 files only.' })
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional({ example: 'S3' })
  @IsOptional()
  @IsString()
  storageProvider?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bucket?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  objectKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sha256?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  etag?: string;
}

export class CreateMedicalResultDto {
  @ApiPropertyOptional({ example: 'Ghi chú thêm từ kỹ thuật viên phòng Lab' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ type: [MedicalResultFileDto], description: 'Danh sách ảnh/PDF kết quả đã upload' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MedicalResultFileDto)
  files!: MedicalResultFileDto[];
}

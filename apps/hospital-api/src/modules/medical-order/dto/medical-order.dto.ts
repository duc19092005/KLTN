import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MedicalOrderStatus } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
  ArrayMinSize,
  ValidateIf,
  IsEmpty,
} from 'class-validator';
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

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ default: 10, description: 'Cố định tối đa 10 phiếu trên mỗi trang.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
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

  @ApiPropertyOptional({
    description: 'Không dùng cho file y tế mới. Public URL bị từ chối; chỉ S3 private metadata được chấp nhận.',
  })
  @ValidateIf((_, value) => value !== undefined && value !== null && value !== '')
  @IsEmpty({ message: 'Không được gửi URL công khai cho file kết quả y tế mới.' })
  url?: string;

  @ApiProperty({ example: 'S3' })
  @IsString()
  @IsIn(['S3'], { message: 'File y tế mới chỉ được lưu bằng AWS S3 private.' })
  storageProvider!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  bucket!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  objectKey!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  sha256!: string;

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

  @ApiProperty({ type: [MedicalResultFileDto], minItems: 1, description: 'Danh sách ảnh/PDF kết quả đã upload. Bắt buộc có ít nhất 1 file.' })
  @IsArray()
  @ArrayMinSize(1, { message: 'Vui lòng cung cấp ít nhất một file kết quả PDF hoặc hình ảnh.' })
  @ValidateNested({ each: true })
  @Type(() => MedicalResultFileDto)
  files!: MedicalResultFileDto[];
}

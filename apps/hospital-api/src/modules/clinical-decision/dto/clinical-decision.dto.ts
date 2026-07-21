import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class GenerateAiAnalysisDto {
  @ApiProperty()
  @IsUUID()
  visitId!: string;

  @ApiPropertyOptional({ description: 'Nếu không truyền, hệ thống lấy model mới nhất theo chuyên khoa hoặc model đầu tiên' })
  @IsOptional()
  @IsUUID()
  aiModelId?: string;
}

export class ReviewAiDiagnosisDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  doctorFeedback?: string;
}

export class CreateMedicalConclusionDto {
  @ApiProperty()
  @IsUUID()
  visitId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  aiDiagnosisId?: string;

  @ApiProperty({ example: 'Viêm đường hô hấp trên' })
  @IsString()
  @IsNotEmpty()
  finalDiagnosis!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  treatmentPlan?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  prescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  followUpNote?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  doctorNote?: string;
}

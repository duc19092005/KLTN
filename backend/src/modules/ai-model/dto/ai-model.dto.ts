import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, IsUrl, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { OperationalStatus } from '@prisma/client';

import { PaginationQueryDto } from '../../shared/pagination.dto';

export const AI_MODEL_TYPES = ['API', 'IP'] as const;
export const AI_API_PROVIDERS = ['chatgpt', 'gemini', 'deepseek', 'qwen', 'anthropic', 'local', 'other'] as const;

export const AI_MODEL_VERSION_REGEX = /^[A-Za-z0-9._:/@-]+$/;

export class CreateAiModelDto {
  @ApiProperty({ example: 'GPT-4o Medical Assistant' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  modelName!: string;

  @ApiProperty({ example: '2026.05' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  @Matches(AI_MODEL_VERSION_REGEX, { message: 'modelVersion chỉ được chứa chữ, số và các ký tự ., _, -, /, :, @.' })
  modelVersion!: string;

  @ApiPropertyOptional({ example: 'Tim mạch' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  recommendedSpecialty?: string;

  @ApiProperty({ enum: AI_MODEL_TYPES, description: 'API = model từ nền tảng AI, IP = model nội bộ theo IP/hash' })
  @IsIn(AI_MODEL_TYPES)
  type!: 'API' | 'IP';

  @ApiPropertyOptional({ enum: AI_API_PROVIDERS, description: 'Provider khi type=API' })
  @IsOptional()
  @IsIn(AI_API_PROVIDERS)
  provider?: string;

  @ApiPropertyOptional({ example: 'https://api.openai.com/v1/chat/completions', description: 'Optional; backend can infer from provider' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  apiEndpoint?: string;

  @ApiPropertyOptional({
    description:
      'API key/token. Tùy chọn cho model local/self-hosted (Llama, Ollama, vLLM) vốn không cần key. ' +
      'Khi có giá trị, backend mã hóa AES-256 trước khi lưu; khi trống, hệ thống dùng endpoint làm định danh.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  secretOrIpHash?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateAiModelDto {
  @ApiPropertyOptional({ example: 'GPT-4o Medical Assistant' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  modelName?: string;

  @ApiPropertyOptional({ example: '2026.05' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  @Matches(AI_MODEL_VERSION_REGEX, { message: 'modelVersion chỉ được chứa chữ, số và các ký tự ., _, -, /, :, @.' })
  modelVersion?: string;

  @ApiPropertyOptional({ example: 'Tim mạch' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  recommendedSpecialty?: string;

  @ApiPropertyOptional({ enum: AI_MODEL_TYPES })
  @IsOptional()
  @IsIn(AI_MODEL_TYPES)
  type?: 'API' | 'IP';

  @ApiPropertyOptional({ enum: AI_API_PROVIDERS })
  @IsOptional()
  @IsIn(AI_API_PROVIDERS)
  provider?: string;

  @ApiPropertyOptional({ example: 'https://api.openai.com/v1/chat/completions' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  apiEndpoint?: string;

  @ApiPropertyOptional({ description: 'New API key/token. Leave blank/omit to keep the current encrypted secret.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  secretOrIpHash?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class AiModelQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: AI_MODEL_TYPES })
  @IsOptional()
  @IsIn(AI_MODEL_TYPES)
  type?: 'API' | 'IP';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiPropertyOptional({ example: true, description: 'Include soft-deleted AI models' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  includeDeleted?: boolean;

  @ApiPropertyOptional({ enum: OperationalStatus, description: 'Filter AI models by visibility/status' })
  @IsOptional()
  @IsIn([OperationalStatus.ACTIVE, OperationalStatus.INACTIVE])
  status?: OperationalStatus;
}

export class TestAiModelApiDto {
  @ApiProperty({ enum: AI_API_PROVIDERS })
  @IsIn(AI_API_PROVIDERS)
  provider!: string;

  @ApiProperty({ example: 'gemini-1.5-pro' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  @Matches(AI_MODEL_VERSION_REGEX, { message: 'modelVersion chỉ được chứa chữ, số và các ký tự ., _, -, /, :, @.' })
  modelVersion!: string;

  @ApiPropertyOptional({ description: 'API key/token dùng để test, không lưu DB. Tùy chọn cho model local.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  secretOrIpHash?: string;

  @ApiPropertyOptional({ description: 'Optional override endpoint' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  apiEndpoint?: string;
}

export class RateAiModelDto {
  @ApiProperty({ example: true, description: 'True nếu hài lòng/mô hình dự đoán đúng, False nếu không' })
  @IsBoolean()
  satisfied!: boolean;

  @ApiPropertyOptional({ example: 'Mô hình dự đoán chưa chính xác về kết quả chụp X-quang phổi', description: 'Ghi chú lý do nếu không hài lòng' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  feedback?: string;
}

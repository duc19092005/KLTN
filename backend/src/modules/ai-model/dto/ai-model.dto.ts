import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export const AI_MODEL_TYPES = ['API', 'IP'] as const;
export const AI_API_PROVIDERS = ['chatgpt', 'gemini', 'deepseek', 'qwen', 'anthropic', 'other'] as const;

export class CreateAiModelDto {
  @ApiProperty({ example: 'GPT-4o Medical Assistant' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  modelName!: string;

  @ApiProperty({ example: '2026.05' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  modelVersion!: string;

  @ApiPropertyOptional({ example: 'Tim mạch' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
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
  apiEndpoint?: string;

  @ApiProperty({ description: 'API key/token hoặc IP/hash gốc. Backend sẽ mã hóa AES-256 trước khi lưu.' })
  @IsString()
  @IsNotEmpty()
  secretOrIpHash!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

export class AiModelQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: AI_MODEL_TYPES })
  @IsOptional()
  @IsIn(AI_MODEL_TYPES)
  type?: 'API' | 'IP';
}

export class TestAiModelApiDto {
  @ApiProperty({ enum: AI_API_PROVIDERS })
  @IsIn(AI_API_PROVIDERS)
  provider!: string;

  @ApiProperty({ example: 'gemini-1.5-pro' })
  @IsString()
  @IsNotEmpty()
  modelVersion!: string;

  @ApiProperty({ description: 'API key/token dùng để test, không lưu DB.' })
  @IsString()
  @IsNotEmpty()
  secretOrIpHash!: string;

  @ApiPropertyOptional({ description: 'Optional override endpoint' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiEndpoint?: string;
}

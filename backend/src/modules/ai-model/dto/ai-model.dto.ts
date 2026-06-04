import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export const AI_MODEL_TYPES = ['API', 'IP'] as const;
export const AI_API_PROVIDERS = ['chatgpt', 'gemini', 'deepseek', 'qwen', 'anthropic', 'local', 'other'] as const;

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

  @ApiPropertyOptional({
    description:
      'API key/token. Tùy chọn cho model local/self-hosted (Llama, Ollama, vLLM) vốn không cần key. ' +
      'Khi có giá trị, backend mã hóa AES-256 trước khi lưu; khi trống, hệ thống dùng endpoint làm định danh.',
  })
  @IsOptional()
  @IsString()
  secretOrIpHash?: string;

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

  @ApiPropertyOptional({ description: 'API key/token dùng để test, không lưu DB. Tùy chọn cho model local.' })
  @IsOptional()
  @IsString()
  secretOrIpHash?: string;

  @ApiPropertyOptional({ description: 'Optional override endpoint' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiEndpoint?: string;
}

export class RateAiModelDto {
  @ApiProperty({ example: true, description: 'True nếu hài lòng/mô hình dự đoán đúng, False nếu không' })
  satisfied!: boolean;

  @ApiPropertyOptional({ example: 'Mô hình dự đoán chưa chính xác về kết quả chụp X-quang phổi', description: 'Ghi chú lý do nếu không hài lòng' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  feedback?: string;
}

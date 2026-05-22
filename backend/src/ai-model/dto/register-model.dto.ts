import { IsString, IsNotEmpty, IsOptional, MinLength } from 'class-validator';

export class RegisterModelDto {
  @IsString()
  @IsOptional()
  @MinLength(3)
  modelId?: string;

  @IsString()
  @IsNotEmpty()
  modelName: string;

  @IsString()
  @IsNotEmpty()
  modelVersion: string;

  @IsString()
  @IsOptional()
  recommendedSpecialty?: string;

  @IsString()
  @IsNotEmpty()
  ipHash: string; // Plain IP hash - will be encrypted before storing

  @IsString()
  @IsOptional()
  description?: string;
}

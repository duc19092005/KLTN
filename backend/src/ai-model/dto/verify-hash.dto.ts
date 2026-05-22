import { IsString, IsNotEmpty } from 'class-validator';

export class VerifyHashDto {
  @IsString()
  @IsNotEmpty()
  modelId: string;

  @IsString()
  @IsNotEmpty()
  ipHash: string; // IP hash to verify
}

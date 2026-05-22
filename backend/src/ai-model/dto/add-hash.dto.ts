import { IsString, IsNotEmpty } from 'class-validator';

export class AddHashDto {
  @IsString()
  @IsNotEmpty()
  modelId: string;

  @IsString()
  @IsNotEmpty()
  ipHash: string; // New IP hash to add
}

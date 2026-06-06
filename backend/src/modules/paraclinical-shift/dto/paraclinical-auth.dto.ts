import { IsString, IsArray, Length } from 'class-validator';

export class ParaclinicalLoginDto {
  @IsString()
  @Length(3, 128)
  username: string;

  @IsString()
  @Length(6, 256)
  password: string;
}

export class VerifyShiftFaceDto {
  @IsString()
  tempToken: string;

  @IsArray()
  faceDescriptor: number[];
}

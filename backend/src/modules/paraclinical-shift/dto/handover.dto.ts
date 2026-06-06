import { IsString, IsArray, IsOptional, IsUUID, MaxLength } from 'class-validator';

export class InitiateHandoverDto {
  @IsUUID()
  toStaffId: string;

  @IsUUID()
  clinicalRoomId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class VerifyHandoverFaceDto {
  @IsUUID()
  handoverId: string;

  @IsArray()
  faceDescriptor: number[];
}

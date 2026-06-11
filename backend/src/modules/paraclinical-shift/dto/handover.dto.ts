import { IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class InitiateHandoverDto {
  @IsUUID()
  toStaffId: string;

  @IsUUID()
  departmentId: string;

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

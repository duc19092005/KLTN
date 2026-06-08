import { ShiftCode } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class RegisterReceptionShiftDto {
  @IsUUID()
  departmentId: string;

  @IsDateString()
  workDate: string;

  @IsEnum(ShiftCode)
  shiftCode: ShiftCode;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class AssignReceptionShiftDto extends RegisterReceptionShiftDto {
  @IsUUID()
  staffId: string;
}

export class ApproveReceptionShiftDto {
  @IsUUID()
  shiftId: string;
}

export class RejectReceptionShiftDto {
  @IsUUID()
  shiftId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

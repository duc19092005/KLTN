import { Type } from 'class-transformer';
import { ShiftCode } from '@prisma/client';
import { ArrayMinSize, IsArray, IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';

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

export class RegisterManyReceptionShiftDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RegisterReceptionShiftDto)
  items: RegisterReceptionShiftDto[];
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

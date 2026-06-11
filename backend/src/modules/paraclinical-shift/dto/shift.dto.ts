import { ShiftCode } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';

export class RegisterShiftDto {
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

export class RegisterManyShiftsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(62)
  @ValidateNested({ each: true })
  @Type(() => RegisterShiftDto)
  shifts: RegisterShiftDto[];
}

export class ApproveShiftDto {
  @IsUUID()
  shiftId: string;
}

export class RejectShiftDto {
  @IsUUID()
  shiftId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class AssignShiftDto {
  @IsUUID()
  staffId: string;

  @IsUUID()
  departmentId: string;

  @IsDateString()
  workDate: string;

  @IsEnum(ShiftCode)
  shiftCode: ShiftCode;
}

export class ListRoomShiftsDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

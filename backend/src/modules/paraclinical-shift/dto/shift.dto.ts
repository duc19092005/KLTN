import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class RegisterShiftDto {
  @IsUUID()
  departmentId: string;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
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
  startTime: string;

  @IsDateString()
  endTime: string;
}

export class ListRoomShiftsDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

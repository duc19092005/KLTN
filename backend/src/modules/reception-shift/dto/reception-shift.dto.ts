import { IsDateString, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/** Body for receptionists self-registering a new shift on an administrative department. */
export class RegisterReceptionShiftDto {
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

/** Body for the manager/admin rejecting a shift; reason is optional but useful for audit. */
export class RejectReceptionShiftDto {
  @IsOptional()
  @IsString()
  @MinLength(0)
  @MaxLength(500)
  reason?: string;
}

/** Body for admin direct-assignment: pre-approved shift on behalf of a receptionist. */
export class AssignReceptionShiftDto {
  @IsUUID()
  staffId: string;

  @IsUUID()
  departmentId: string;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;
}

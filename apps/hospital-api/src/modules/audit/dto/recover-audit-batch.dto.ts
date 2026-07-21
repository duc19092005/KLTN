import { IsString, Length } from 'class-validator';

export class RecoverAuditBatchDto {
  @IsString()
  @Length(10, 500)
  reason!: string;
}

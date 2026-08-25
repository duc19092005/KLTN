import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsString, IsUUID, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { RECOVERABLE_AUDIT_ENTITIES, RecoverableAuditEntity } from '../../../infrastructure/audit';

export class RecoverAuditEntityTargetDto {
  @IsIn(RECOVERABLE_AUDIT_ENTITIES)
  entity!: RecoverableAuditEntity;

  @IsUUID()
  entityId!: string;
}

export class RecoverAuditEntitiesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => RecoverAuditEntityTargetDto)
  items!: RecoverAuditEntityTargetDto[];

  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason!: string;
}

export class PreviewRecoverAuditEntitiesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => RecoverAuditEntityTargetDto)
  items!: RecoverAuditEntityTargetDto[];
}

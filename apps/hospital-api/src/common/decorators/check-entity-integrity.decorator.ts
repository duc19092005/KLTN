import { SetMetadata } from '@nestjs/common';

export interface CheckEntityIntegrityOptions {
  entity?: string;
  paramKey?: string;
}

export const CHECK_ENTITY_INTEGRITY_KEY = 'check_entity_integrity';

export const CheckEntityIntegrity = (options: CheckEntityIntegrityOptions = {}) =>
  SetMetadata(CHECK_ENTITY_INTEGRITY_KEY, options);

import { Global, Module } from '@nestjs/common';
import { AuditLoggerService } from './audit-logger.service';

/**
 * Global module exposing the centralized BlockchainLogger writer to every feature module.
 * Marked @Global so services can inject AuditLoggerService without importing this module
 * everywhere.
 */
@Global()
@Module({
  providers: [AuditLoggerService],
  exports: [AuditLoggerService],
})
export class AuditModule {}

import { Module } from '@nestjs/common';
import { AuditController } from './controllers/audit.controller';

/**
 * Feature module exposing the admin Audit & Integrity API. The audit services themselves
 * (AuditLoggerService, AuditAnchorService) come from the @Global AuditModule, and PrismaService
 * from the @Global PrismaModule, so this module only needs to register the controller.
 */
@Module({
  controllers: [AuditController],
})
export class AuditApiModule {}

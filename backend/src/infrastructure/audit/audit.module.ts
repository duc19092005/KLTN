import { Global, Module } from '@nestjs/common';
import { AuditLoggerService } from './audit-logger.service';
import { AuditAnchorService } from './audit-anchor.service';
import { BlockchainModule } from '../blockchain/blockchain.module';

/**
 * Global module exposing the tamper-evident audit infrastructure to every feature module:
 *  - AuditLoggerService: hash-chained, append-only writer/reader for BlockchainLogger.
 *  - AuditAnchorService: periodic Merkle-root batch anchoring + inclusion proofs.
 *
 * Marked @Global so services can inject AuditLoggerService without importing this module
 * everywhere. BlockchainModule is imported here for the on-chain commit path.
 */
@Global()
@Module({
  imports: [BlockchainModule],
  providers: [AuditLoggerService, AuditAnchorService],
  exports: [AuditLoggerService, AuditAnchorService],
})
export class AuditModule {}

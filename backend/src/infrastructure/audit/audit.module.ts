import { Global, Module } from '@nestjs/common';
import { AuditLoggerService } from './audit-logger.service';
import { AuditAnchorService } from './audit-anchor.service';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { AuditRecoveryCryptoService } from './audit-recovery-crypto.service';
import { IpfsArtifactService } from './ipfs-artifact.service';
import { AuditArtifactService } from './audit-artifact.service';
import { AuditRecoveryService } from './audit-recovery.service';
import { AuditKafkaService } from './audit-kafka.service';
import { EntityRecoveryService } from './entity-recovery.service';
import { EntityRecreationService } from './entity-recreation.service';

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
  providers: [
    AuditLoggerService,
    AuditAnchorService,
    AuditRecoveryCryptoService,
    IpfsArtifactService,
    AuditArtifactService,
    AuditRecoveryService,
    AuditKafkaService,
    EntityRecoveryService,
    EntityRecreationService,
  ],
  exports: [AuditLoggerService, AuditAnchorService, AuditArtifactService, AuditRecoveryService, EntityRecoveryService, EntityRecreationService],
})
export class AuditModule {}

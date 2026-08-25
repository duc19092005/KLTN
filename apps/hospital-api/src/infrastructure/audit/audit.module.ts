import { Global, Module } from '@nestjs/common';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { AuditRecoveryCryptoService } from './crypto/audit-recovery-crypto.service';
import { IpfsArtifactService } from './ipfs/ipfs-artifact.service';
import { AuditArtifactService } from './ipfs/audit-artifact.service';
import { AuditLoggerService } from './logging/audit-logger.service';
import { AuditAnchorService } from './anchoring/audit-anchor.service';
import { AuditRecoveryService } from './recovery/audit-recovery.service';
import { EntityRecoveryService } from './recovery/entity-recovery.service';
import { EntityRecreationService } from './recovery/entity-recreation.service';

/**
 * Global module exposing the tamper-evident audit infrastructure to every feature module:
 *  - AuditLoggerService: hash-chained, append-only writer/reader for BlockchainLogger.
 *  - AuditAnchorService: periodic Merkle-root batch anchoring + inclusion proofs.
 *  - AuditArtifactService: IPFS recovery bundle creation & download.
 *  - AuditRecoveryService: Batch watchdog & self-healing coordinator.
 *  - EntityRecoveryService: Clinical integrity warning & entity restoration.
 *  - EntityRecreationService: Topological missing entity recreation.
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
    EntityRecoveryService,
    EntityRecreationService,
  ],
  exports: [
    AuditLoggerService,
    AuditAnchorService,
    AuditArtifactService,
    AuditRecoveryService,
    EntityRecoveryService,
    EntityRecreationService,
    IpfsArtifactService,
  ],
})
export class AuditModule {}

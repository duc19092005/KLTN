import { Global, Module } from '@nestjs/common';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { AuditRecoveryCryptoService } from './crypto/audit-recovery-crypto.service';
import { IpfsArtifactService } from './ipfs/ipfs-artifact.service';
import { AuditArtifactService } from './ipfs/audit-artifact.service';
import { AuditLoggerService } from './logging/audit-logger.service';
import { AuditAnchorService } from './anchoring/audit-anchor.service';
import { AuditTelegramAlertService } from './anchoring/audit-telegram-alert.service';
import { AuditChainVerifier } from './anchoring/audit-chain-verifier';
import { AuditProofService } from './anchoring/audit-proof.service';
import { AuditBatchArtifactPublisher } from './anchoring/audit-batch-artifact-publisher';
import { AuditPendingBatchResumer } from './anchoring/audit-pending-batch-resumer';
import { AuditBatchPreparer } from './anchoring/audit-batch-preparer';
import { AuditPageIntegrityService } from './anchoring/audit-page-integrity.service';
import { AuditRecoveryService } from './recovery/audit-recovery.service';
import { VerifiedAuditBundleReader } from './recovery/verified-audit-bundle.reader';
import { AuditBatchScanner } from './recovery/audit-batch-scanner';
import { AuditBatchRestorer } from './recovery/audit-batch-restorer';
import { AuditWatchdogScheduler } from './recovery/audit-watchdog.scheduler';
import { AuditDeepScanService } from './recovery/audit-deep-scan.service';
import { EntityRecoveryService } from './recovery/entity-recovery.service';
import { EntityRecreationService } from './recovery/entity-recreation.service';
import { ClinicalAuditTrustService } from './recovery/clinical-audit-trust.service';

/**
 * Global module exposing the tamper-evident audit infrastructure to every feature module.
 */
@Global()
@Module({
  imports: [BlockchainModule],
  providers: [
    AuditTelegramAlertService,
    AuditChainVerifier,
    AuditProofService,
    AuditBatchArtifactPublisher,
    AuditPendingBatchResumer,
    AuditBatchPreparer,
    AuditLoggerService,
    AuditAnchorService,
    AuditPageIntegrityService,
    AuditRecoveryCryptoService,
    IpfsArtifactService,
    AuditArtifactService,
    VerifiedAuditBundleReader,
    AuditBatchScanner,
    AuditBatchRestorer,
    AuditWatchdogScheduler,
    AuditDeepScanService,
    AuditRecoveryService,
    EntityRecoveryService,
    EntityRecreationService,
    ClinicalAuditTrustService,
  ],
  exports: [
    AuditTelegramAlertService,
    AuditChainVerifier,
    AuditProofService,
    AuditBatchArtifactPublisher,
    AuditPendingBatchResumer,
    AuditBatchPreparer,
    AuditLoggerService,
    AuditAnchorService,
    AuditPageIntegrityService,
    AuditArtifactService,
    VerifiedAuditBundleReader,
    AuditBatchScanner,
    AuditBatchRestorer,
    AuditWatchdogScheduler,
    AuditDeepScanService,
    AuditRecoveryService,
    EntityRecoveryService,
    EntityRecreationService,
    ClinicalAuditTrustService,
    IpfsArtifactService,
  ],
})
export class AuditModule {}

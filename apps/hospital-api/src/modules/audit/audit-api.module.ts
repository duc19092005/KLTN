import { Module } from '@nestjs/common';
import { AuditController } from './controllers/audit.controller';
import { BlockchainModule } from '../../infrastructure/blockchain/blockchain.module';
import { AuditSubjectResolverService } from './application/services/audit-subject-resolver.service';
import { AuditPresenter } from './application/presenters/audit.presenter';
import { ListAuditLogsQuery } from './application/queries/list-audit-logs.query';
import { ListAuditBatchesQuery } from './application/queries/list-audit-batches.query';

@Module({
  imports: [BlockchainModule],
  controllers: [AuditController],
  providers: [
    AuditSubjectResolverService,
    AuditPresenter,
    ListAuditLogsQuery,
    ListAuditBatchesQuery,
  ],
  exports: [
    AuditSubjectResolverService,
    AuditPresenter,
    ListAuditLogsQuery,
    ListAuditBatchesQuery,
  ],
})
export class AuditApiModule {}

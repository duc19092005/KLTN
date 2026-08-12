import { Module } from '@nestjs/common';
import { AuditController } from './controllers/audit.controller';
import { BlockchainModule } from '../../infrastructure/blockchain/blockchain.module';

@Module({
  imports: [BlockchainModule],
  controllers: [AuditController],
})
export class AuditApiModule {}

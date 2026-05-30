import { Module, forwardRef } from '@nestjs/common';
import { StaffController } from './controllers/staff.controller';
import { StaffService } from './services/staff.service';
import { BlockchainModule } from '../../infrastructure/blockchain/blockchain.module';
import { DoctorModule } from '../doctor/doctor.module';

@Module({
  imports: [BlockchainModule, forwardRef(() => DoctorModule)],
  controllers: [StaffController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffEnterpriseModule {}

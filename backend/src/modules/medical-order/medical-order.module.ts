import { Module } from '@nestjs/common';
import { MedicalOrderController } from './controllers/medical-order.controller';
import { MedicalOrderService } from './services/medical-order.service';

@Module({
  controllers: [MedicalOrderController],
  providers: [MedicalOrderService],
  exports: [MedicalOrderService],
})
export class MedicalOrderModule {}

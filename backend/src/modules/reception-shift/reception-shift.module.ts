import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { ReceptionShiftController } from './reception-shift.controller';
import { ReceptionShiftService } from './reception-shift.service';

@Module({
  imports: [PrismaModule, NotificationModule],
  controllers: [ReceptionShiftController],
  providers: [ReceptionShiftService],
  exports: [ReceptionShiftService],
})
export class ReceptionShiftModule {}

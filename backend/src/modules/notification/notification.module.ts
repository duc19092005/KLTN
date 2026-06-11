import { Module, Global } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationController } from './controllers/notification.controller';
import { NotificationService } from './services/notification.service';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}

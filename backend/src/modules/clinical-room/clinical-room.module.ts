import { Module } from '@nestjs/common';
import { ClinicalRoomController } from './controllers/clinical-room.controller';
import { ClinicalRoomService } from './services/clinical-room.service';

@Module({
  controllers: [ClinicalRoomController],
  providers: [ClinicalRoomService],
  exports: [ClinicalRoomService],
})
export class ClinicalRoomModule {}

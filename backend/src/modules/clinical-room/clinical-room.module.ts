import { Module } from '@nestjs/common';
import { ClinicalRoomController } from './controllers/clinical-room.controller';
import { ClinicalRoomService } from './services/clinical-room.service';
import { CreateClinicalRoomUseCase } from './application/use-cases/create-clinical-room.use-case';
import { ListClinicalRoomsUseCase } from './application/use-cases/list-clinical-rooms.use-case';
import { UpdateClinicalRoomUseCase } from './application/use-cases/update-clinical-room.use-case';
import { AssignRoomDoctorUseCase } from './application/use-cases/assign-room-doctor.use-case';
import { RemoveClinicalRoomUseCase } from './application/use-cases/remove-clinical-room.use-case';
import { ClinicalRoomValidator } from './application/services/clinical-room.validator';
import { CLINICAL_ROOM_REPOSITORY } from './application/ports/clinical-room.repository.port';
import { PrismaClinicalRoomRepository } from './infrastructure/prisma/prisma-clinical-room.repository';

@Module({
  controllers: [ClinicalRoomController],
  providers: [
    ClinicalRoomService,
    CreateClinicalRoomUseCase,
    ListClinicalRoomsUseCase,
    UpdateClinicalRoomUseCase,
    AssignRoomDoctorUseCase,
    RemoveClinicalRoomUseCase,
    ClinicalRoomValidator,
    { provide: CLINICAL_ROOM_REPOSITORY, useClass: PrismaClinicalRoomRepository },
  ],
  exports: [ClinicalRoomService],
})
export class ClinicalRoomModule {}

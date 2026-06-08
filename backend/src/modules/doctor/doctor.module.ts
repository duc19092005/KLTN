import { Module } from '@nestjs/common';
import { DoctorController } from './controllers/doctor.controller';
import { DoctorService } from './services/doctor.service';
import { BlockchainModule } from '../../infrastructure/blockchain/blockchain.module';
import { CreateDoctorUseCase } from './application/use-cases/create-doctor.use-case';
import { CreateDoctorWithStaffUseCase } from './application/use-cases/create-doctor-with-staff.use-case';
import { ListDoctorsUseCase } from './application/use-cases/list-doctors.use-case';
import { UpdateDoctorUseCase } from './application/use-cases/update-doctor.use-case';
import { VerifyDoctorUseCase } from './application/use-cases/verify-doctor.use-case';
import { ReanchorDoctorForStaffUpdateUseCase } from './application/use-cases/reanchor-doctor-for-staff-update.use-case';
import { DOCTOR_REPOSITORY } from './application/ports/doctor.repository.port';
import { DOCTOR_INTEGRITY_ANCHOR } from './application/ports/doctor-integrity-anchor.port';
import { DOCTOR_REANCHOR } from './application/ports/doctor-reanchor.port';
import { PrismaDoctorRepository } from './infrastructure/prisma/prisma-doctor.repository';
import { BlockchainDoctorIntegrityAnchor } from './infrastructure/adapters/blockchain-doctor-integrity.anchor';

@Module({
  imports: [BlockchainModule],
  controllers: [DoctorController],
  providers: [
    DoctorService,
    CreateDoctorUseCase,
    CreateDoctorWithStaffUseCase,
    ListDoctorsUseCase,
    UpdateDoctorUseCase,
    VerifyDoctorUseCase,
    ReanchorDoctorForStaffUpdateUseCase,
    { provide: DOCTOR_REPOSITORY, useClass: PrismaDoctorRepository },
    { provide: DOCTOR_INTEGRITY_ANCHOR, useClass: BlockchainDoctorIntegrityAnchor },
    // Expose the narrow re-anchor seam so StaffModule can avoid a forwardRef to DoctorService.
    { provide: DOCTOR_REANCHOR, useExisting: ReanchorDoctorForStaffUpdateUseCase },
  ],
  exports: [DoctorService, DOCTOR_REANCHOR],
})
export class DoctorModule {}

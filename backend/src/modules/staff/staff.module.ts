import { Module } from '@nestjs/common';
import { StaffController } from './controllers/staff.controller';
import { StaffService } from './services/staff.service';
import { BlockchainModule } from '../../infrastructure/blockchain/blockchain.module';
import { DoctorModule } from '../doctor/doctor.module';
import { CreateStaffUseCase } from './application/use-cases/create-staff.use-case';
import { ListStaffUseCase } from './application/use-cases/list-staff.use-case';
import { UpdateStaffUseCase } from './application/use-cases/update-staff.use-case';
import { SetStaffStatusUseCase } from './application/use-cases/set-staff-status.use-case';
import { VerifyStaffUseCase } from './application/use-cases/verify-staff.use-case';
import { StaffValidator } from './application/services/staff.validator';
import { STAFF_REPOSITORY } from './application/ports/staff.repository.port';
import { STAFF_INTEGRITY_ANCHOR } from './application/ports/staff-integrity-anchor.port';
import { PASSWORD_HASHER } from './application/ports/password-hasher.port';
import { PrismaStaffRepository } from './infrastructure/prisma/prisma-staff.repository';
import { BlockchainStaffIntegrityAnchor } from './infrastructure/adapters/blockchain-staff-integrity.anchor';
import { BcryptPasswordHasher } from './infrastructure/adapters/bcrypt-password-hasher.adapter';

// DoctorModule is imported directly (no forwardRef): StaffModule consumes the narrow
// DOCTOR_REANCHOR port it exports. DoctorModule does not depend on StaffModule, so there
// is no circular dependency.
@Module({
  imports: [BlockchainModule, DoctorModule],
  controllers: [StaffController],
  providers: [
    StaffService,
    CreateStaffUseCase,
    ListStaffUseCase,
    UpdateStaffUseCase,
    SetStaffStatusUseCase,
    VerifyStaffUseCase,
    StaffValidator,
    { provide: STAFF_REPOSITORY, useClass: PrismaStaffRepository },
    { provide: STAFF_INTEGRITY_ANCHOR, useClass: BlockchainStaffIntegrityAnchor },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
  ],
  exports: [StaffService],
})
export class StaffEnterpriseModule {}

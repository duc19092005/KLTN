import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';

// Controllers
import { ShiftController } from './controllers/shift.controller';
import { HandoverController } from './controllers/handover.controller';

// Service facade
import { ParaclinicalShiftService } from './services/paraclinical-shift.service';

// Use cases
import { RegisterShiftUseCase } from './application/use-cases/register-shift.use-case';
import { ApproveShiftUseCase } from './application/use-cases/approve-shift.use-case';
import { RejectShiftUseCase } from './application/use-cases/reject-shift.use-case';
import { AssignShiftUseCase } from './application/use-cases/assign-shift.use-case';
import { ListRoomShiftsUseCase } from './application/use-cases/list-room-shifts.use-case';
import { ListPendingShiftsUseCase } from './application/use-cases/list-pending-shifts.use-case';
import { InitiateHandoverUseCase } from './application/use-cases/initiate-handover.use-case';
import { VerifyHandoverFaceAUseCase } from './application/use-cases/verify-handover-face-a.use-case';
import { VerifyHandoverFaceBUseCase } from './application/use-cases/verify-handover-face-b.use-case';

// Ports -> adapters
import { PARACLINICAL_SHIFT_REPOSITORY } from './application/ports/paraclinical-shift.repository.port';
import { PrismaParaclinicalShiftRepository } from './infrastructure/prisma/prisma-paraclinical-shift.repository';
import { BlockchainParaclinicalShiftIntegrityAnchor } from './infrastructure/adapters/blockchain-paraclinical-shift-integrity.anchor';

import { VerifyParaclinicalShiftUseCase } from './application/use-cases/verify-paraclinical-shift.use-case';

/**
 * Feature module for paraclinical shift management and dual-biometric handover.
 * Imports AuthModule for FaceMatchService, JWT, and
 * auth ports (AUTH_REPOSITORY, SECURITY_EVENT_LOGGER).
 *
 * AuditModule and BlockchainModule are @Global, so they are available without
 * explicit import.
 */
@Module({
  imports: [AuthModule],
  controllers: [ShiftController, HandoverController],
  providers: [
    ParaclinicalShiftService,
    BlockchainParaclinicalShiftIntegrityAnchor,

    // Use cases
    RegisterShiftUseCase,
    ApproveShiftUseCase,
    RejectShiftUseCase,
    AssignShiftUseCase,
    ListRoomShiftsUseCase,
    ListPendingShiftsUseCase,
    InitiateHandoverUseCase,
    VerifyHandoverFaceAUseCase,
    VerifyHandoverFaceBUseCase,
    VerifyParaclinicalShiftUseCase,

    // Ports -> adapters
    { provide: PARACLINICAL_SHIFT_REPOSITORY, useClass: PrismaParaclinicalShiftRepository },
  ],
  exports: [ParaclinicalShiftService, BlockchainParaclinicalShiftIntegrityAnchor],
})
export class ParaclinicalShiftModule {}

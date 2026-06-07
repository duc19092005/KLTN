import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';

import { ReceptionShiftController } from './controllers/reception-shift.controller';

import { RegisterReceptionShiftUseCase } from './application/use-cases/register-reception-shift.use-case';
import { ApproveReceptionShiftUseCase } from './application/use-cases/approve-reception-shift.use-case';
import { RejectReceptionShiftUseCase } from './application/use-cases/reject-reception-shift.use-case';
import { CancelReceptionShiftUseCase } from './application/use-cases/cancel-reception-shift.use-case';
import { ListReceptionShiftsUseCase } from './application/use-cases/list-reception-shifts.use-case';

import { RECEPTION_SHIFT_REPOSITORY } from './application/ports/reception-shift.repository.port';
import { PrismaReceptionShiftRepository } from './infrastructure/prisma/prisma-reception-shift.repository';

/**
 * Reception shift module: receptionists self-register shifts on administrative
 * departments; ADMIN or the department head (StaffProfile.manager) approves/rejects.
 *
 * AuthModule is imported for JwtAuthGuard / RolesGuard. PrismaService and other
 * cross-cutting providers come from @Global modules.
 */
@Module({
  imports: [AuthModule],
  controllers: [ReceptionShiftController],
  providers: [
    RegisterReceptionShiftUseCase,
    ApproveReceptionShiftUseCase,
    RejectReceptionShiftUseCase,
    CancelReceptionShiftUseCase,
    ListReceptionShiftsUseCase,
    { provide: RECEPTION_SHIFT_REPOSITORY, useClass: PrismaReceptionShiftRepository },
  ],
})
export class ReceptionShiftModule {}

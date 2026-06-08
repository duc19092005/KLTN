import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { VisitController } from './controllers/visit.controller';
import { VisitService } from './services/visit.service';
import { VisitTransitionPolicy } from './application/policies/visit-transition.policy';
import { CreateVisitUseCase } from './application/use-cases/create-visit.use-case';
import { ListVisitsUseCase } from './application/use-cases/list-visits.use-case';
import { UpdateVisitStatusUseCase } from './application/use-cases/update-visit-status.use-case';
import { SuggestDepartmentsUseCase } from './application/use-cases/suggest-departments.use-case';
import { VISIT_REPOSITORY } from './application/ports/visit.repository.port';
import { PrismaVisitRepository } from './infrastructure/prisma/prisma-visit.repository';

@Module({
  imports: [PrismaModule],
  controllers: [VisitController],
  providers: [
    VisitService,
    CreateVisitUseCase,
    ListVisitsUseCase,
    UpdateVisitStatusUseCase,
    SuggestDepartmentsUseCase,
    VisitTransitionPolicy,
    { provide: VISIT_REPOSITORY, useClass: PrismaVisitRepository },
  ],
  exports: [VisitService],
})
export class VisitModule {}

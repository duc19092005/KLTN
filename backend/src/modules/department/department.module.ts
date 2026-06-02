import { Module } from '@nestjs/common';
import { DepartmentController } from './controllers/department.controller';
import { DepartmentService } from './services/department.service';
import { BlockchainModule } from '../../infrastructure/blockchain/blockchain.module';
import { CreateDepartmentUseCase } from './application/use-cases/create-department.use-case';
import { ListDepartmentsUseCase } from './application/use-cases/list-departments.use-case';
import { UpdateDepartmentUseCase } from './application/use-cases/update-department.use-case';
import { AssignManagerUseCase } from './application/use-cases/assign-manager.use-case';
import { RemoveDepartmentUseCase } from './application/use-cases/remove-department.use-case';
import { VerifyDepartmentUseCase } from './application/use-cases/verify-department.use-case';
import { DepartmentValidator } from './application/services/department.validator';
import { DEPARTMENT_REPOSITORY } from './application/ports/department.repository.port';
import { DEPARTMENT_INTEGRITY_ANCHOR } from './application/ports/department-integrity-anchor.port';
import { PrismaDepartmentRepository } from './infrastructure/prisma/prisma-department.repository';
import { BlockchainDepartmentIntegrityAnchor } from './infrastructure/adapters/blockchain-department-integrity.anchor';

@Module({
  imports: [BlockchainModule],
  controllers: [DepartmentController],
  providers: [
    DepartmentService,
    CreateDepartmentUseCase,
    ListDepartmentsUseCase,
    UpdateDepartmentUseCase,
    AssignManagerUseCase,
    RemoveDepartmentUseCase,
    VerifyDepartmentUseCase,
    DepartmentValidator,
    { provide: DEPARTMENT_REPOSITORY, useClass: PrismaDepartmentRepository },
    { provide: DEPARTMENT_INTEGRITY_ANCHOR, useClass: BlockchainDepartmentIntegrityAnchor },
  ],
  exports: [DepartmentService],
})
export class DepartmentModule {}

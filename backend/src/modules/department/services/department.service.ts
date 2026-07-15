import { Injectable } from '@nestjs/common';
import { AssignManagerDto, CreateDepartmentDto, DepartmentQueryDto, UpdateDepartmentDto } from '../dto/department.dto';
import { CreateDepartmentUseCase } from '../application/use-cases/create-department.use-case';
import { ListDepartmentsUseCase } from '../application/use-cases/list-departments.use-case';
import { UpdateDepartmentUseCase } from '../application/use-cases/update-department.use-case';
import { AssignManagerUseCase } from '../application/use-cases/assign-manager.use-case';
import { RemoveDepartmentUseCase } from '../application/use-cases/remove-department.use-case';
import { VerifyDepartmentUseCase } from '../application/use-cases/verify-department.use-case';

/**
 * Facade preserving the controller-facing API. Each method delegates to a
 * single use case; no business logic lives here (Clean Architecture refactor).
 */
@Injectable()
export class DepartmentService {
  constructor(
    private readonly createDepartmentUseCase: CreateDepartmentUseCase,
    private readonly listDepartmentsUseCase: ListDepartmentsUseCase,
    private readonly updateDepartmentUseCase: UpdateDepartmentUseCase,
    private readonly assignManagerUseCase: AssignManagerUseCase,
    private readonly removeDepartmentUseCase: RemoveDepartmentUseCase,
    private readonly verifyDepartmentUseCase: VerifyDepartmentUseCase,
  ) {}

  create(dto: CreateDepartmentDto, actorId?: string) {
    return this.createDepartmentUseCase.execute(dto, actorId);
  }

  findAll(query: DepartmentQueryDto) {
    return this.listDepartmentsUseCase.execute(query);
  }

  update(id: string, dto: UpdateDepartmentDto, actorId?: string) {
    return this.updateDepartmentUseCase.execute(id, dto, actorId);
  }

  assignManager(id: string, dto: AssignManagerDto, actorId?: string) {
    return this.assignManagerUseCase.execute(id, dto, actorId);
  }

  remove(id: string, actorId?: string) {
    return this.removeDepartmentUseCase.execute(id, actorId);
  }

  getHistory(id?: string) {
    return this.verifyDepartmentUseCase.history(id);
  }

  verifyDepartment(id: string) {
    return this.verifyDepartmentUseCase.verifyOne(id);
  }

  verifyAll() {
    return this.verifyDepartmentUseCase.verifyAll();
  }
}

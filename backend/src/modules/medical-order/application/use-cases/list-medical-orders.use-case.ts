import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { AuthUser } from '../../../../common/types/auth-user.type';
import { MedicalOrderQueryDto } from '../../dto/medical-order.dto';
import { MedicalOrderAccessPolicy } from '../policies/medical-order-access.policy';
import { MEDICAL_ORDER_REPOSITORY, MedicalOrderRepositoryPort } from '../ports/medical-order.repository.port';

/**
 * Lists medical orders with role-based access scope. The base query filter is
 * merged with the policy scope (doctorId for DOCTOR, targetDepartmentId for
 * LAB_MANAGER), scope taking precedence as in the former applyAccessScope().
 */
@Injectable()
export class ListMedicalOrdersUseCase {
  constructor(
    @Inject(MEDICAL_ORDER_REPOSITORY) private readonly repo: MedicalOrderRepositoryPort,
    private readonly accessPolicy: MedicalOrderAccessPolicy,
  ) {}

  async execute(query: MedicalOrderQueryDto, user: AuthUser): Promise<unknown[]> {
    const scope = await this.accessPolicy.buildListScope(
      user,
      () => this.resolveDoctorId(user.sub),
      () => this.resolveStaff(user.sub),
    );

    return this.repo.findAll({
      status: query.status,
      visitId: query.visitId,
      targetDepartmentId: query.targetDepartmentId,
      ...scope,
    });
  }

  private async resolveDoctorId(userId: string) {
    const doctorId = await this.repo.findDoctorIdByUserId(userId);
    if (!doctorId) throw new ForbiddenException('Tài khoản hiện tại không có hồ sơ bác sĩ.');
    return doctorId;
  }

  private async resolveStaff(userId: string) {
    const staff = await this.repo.findStaffByUserId(userId);
    if (!staff) throw new ForbiddenException('Tài khoản hiện tại không có hồ sơ nhân sự.');
    return staff;
  }
}

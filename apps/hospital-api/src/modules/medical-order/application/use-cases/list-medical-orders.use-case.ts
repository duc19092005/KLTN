import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { AuthUser } from '../../../../common/types/auth-user.type';
import { MedicalOrderQueryDto } from '../../dto/medical-order.dto';
import { MedicalOrderAccessPolicy } from '../policies/medical-order-access.policy';
import { MEDICAL_ORDER_REPOSITORY, MedicalOrderRepositoryPort } from '../ports/medical-order.repository.port';
import {
  MEDICAL_ORDER_INTEGRITY_ANCHOR,
  MEDICAL_RESULT_INTEGRITY_ANCHOR,
  MedicalOrderIntegrityAnchorPort,
  MedicalResultIntegrityAnchorPort,
} from '../ports/medical-integrity-anchor.port';
import { paginated } from '../../../shared/pagination.dto';

/**
 * Lists medical orders with role-based access scope. Each page is fixed to ten
 * orders so one page-level integrity evaluation remains bounded.
 */
@Injectable()
export class ListMedicalOrdersUseCase {
  constructor(
    @Inject(MEDICAL_ORDER_REPOSITORY) private readonly repo: MedicalOrderRepositoryPort,
    @Inject(MEDICAL_ORDER_INTEGRITY_ANCHOR) private readonly orderIntegrity: MedicalOrderIntegrityAnchorPort,
    @Inject(MEDICAL_RESULT_INTEGRITY_ANCHOR) private readonly resultIntegrity: MedicalResultIntegrityAnchorPort,
    private readonly accessPolicy: MedicalOrderAccessPolicy,
  ) {}

  async execute(query: MedicalOrderQueryDto, user: AuthUser) {
    const scope = await this.accessPolicy.buildListScope(
      user,
      () => this.resolveDoctorId(user.sub),
      () => this.resolveStaff(user.sub),
    );
    const page = Math.max(1, Number(query.page) || 1);
    const limit = 10;
    const { items, total } = await this.repo.findAll({
      status: query.status,
      visitId: query.visitId,
      targetDepartmentId: query.targetDepartmentId,
      ...scope,
    }, (page - 1) * limit, limit);
    const orders = items as Array<Record<string, any> & { id: string; results?: any[] }>;
    const orderStates = await this.orderIntegrity.evaluateMany(orders);
    const results = orders.flatMap((order) => order.results ?? []).slice(0, 10);
    const resultStates = await this.resultIntegrity.evaluateMany(results);
    const verified = orders.map((order) => {
      const orderState = orderStates.get(order.id);
      return {
        ...order,
        blockchainStatus: orderState?.status ?? 'UNANCHORED',
        integrity: orderState ?? null,
        results: (order.results ?? []).map((result) => {
          const resultState = resultStates.get(result.id);
          return { ...result, blockchainStatus: resultState?.status ?? 'UNANCHORED', integrity: resultState ?? null };
        }),
      };
    });
    return paginated(verified, total, page, limit);
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

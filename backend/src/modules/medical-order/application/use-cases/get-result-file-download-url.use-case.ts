import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../../../../common/types/auth-user.type';
import { MedicalOrderAccessPolicy } from '../policies/medical-order-access.policy';
import { MEDICAL_RESULT_STORAGE, MedicalResultStoragePort } from '../ports/medical-result-storage.port';
import { MEDICAL_ORDER_REPOSITORY, MedicalOrderRepositoryPort } from '../ports/medical-order.repository.port';

/**
 * Issues a short-lived signed download URL for a result file, gated by the
 * access policy so only the owning doctor, the owning lab department, or an
 * admin can obtain a working link. Behavior copied verbatim from the former
 * MedicalOrderService.getResultFileDownloadUrl().
 */
@Injectable()
export class GetResultFileDownloadUrlUseCase {
  constructor(
    @Inject(MEDICAL_ORDER_REPOSITORY) private readonly repo: MedicalOrderRepositoryPort,
    @Inject(MEDICAL_RESULT_STORAGE) private readonly storage: MedicalResultStoragePort,
    private readonly accessPolicy: MedicalOrderAccessPolicy,
  ) {}

  async execute(fileId: string, user: AuthUser) {
    const file = await this.repo.findResultFileWithOrder(fileId);
    if (!file || !file.order) throw new NotFoundException('Không tìm thấy file kết quả.');

    await this.accessPolicy.assertCanDownloadResultFile(file.order, user, {
      resolveDoctorId: () => this.resolveDoctorId(user.sub),
      resolveStaff: () => this.resolveStaff(user.sub),
    });

    return this.storage.buildSignedDownloadUrl({
      fileName: file.fileName,
      originalName: file.originalName,
      mimeType: file.mimeType,
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

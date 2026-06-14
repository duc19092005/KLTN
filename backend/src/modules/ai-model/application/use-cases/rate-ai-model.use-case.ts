import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { AuditLoggerService } from '../../../../infrastructure/audit/audit-logger.service';

@Injectable()
export class RateAiModelUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLoggerService,
  ) {}

  async execute(aiModelId: string, userId: string, satisfied: boolean, feedback?: string) {
    // 1. Verify model exists
    const model = await this.prisma.aiModelRegistry.findUnique({
      where: { id: aiModelId },
    });
    if (!model || model.isDeleted) {
      throw new NotFoundException('Mô hình AI không tồn tại.');
    }

    // 2. Resolve DoctorProfile ID
    const staff = await this.prisma.staffProfile.findUnique({
      where: { userId },
      include: { doctorProfile: true },
    });
    if (!staff || !staff.doctorProfile) {
      throw new BadRequestException('Chỉ Bác sĩ mới có quyền đánh giá mô hình AI.');
    }
    const doctorId = staff.doctorProfile.id;

    const trustablePercent = satisfied ? 100 : 0;
    const conclusion = feedback?.trim() || (satisfied ? 'Hài lòng với kết quả gợi ý chẩn đoán' : 'Chưa hài lòng với kết quả chẩn đoán');

    // 3. Create AiQuality record
    const aiQuality = await this.prisma.aiQuality.create({
      data: {
        doctorId,
        aiModelId,
        doctorConclusionAboutModel: conclusion,
        trustablePercent,
      },
    });

    // 4. Compute tamper-evidence hash
    const snapshot = {
      doctorId: aiQuality.doctorId,
      aiModelId: aiQuality.aiModelId,
      doctorConclusionAboutModel: aiQuality.doctorConclusionAboutModel,
      trustablePercent: aiQuality.trustablePercent,
    };
    const { salt, hash } = this.audit.hashSnapshot(snapshot);

    // Update hashes in DB
    const updatedQuality = await this.prisma.aiQuality.update({
      where: { id: aiQuality.id },
      data: { hash256: hash, dataSalt: salt },
    });

    // 5. Write to BlockchainLogger for Merkle batching (Tier-B, waiting 5 mins)
    await this.audit.record({
      entity: 'AiQuality',
      entityId: updatedQuality.id,
      action: 'AI_MODEL_RATED',
      actorId: userId,
      dataHash: hash,
      dataSalt: salt,
      before: null,
      after: snapshot,
      onChainStatus: 'PENDING',
      metadata: {
        modelName: model.modelName,
        doctorName: staff.fullName,
        satisfied,
      },
    });

    return updatedQuality;
  }
}

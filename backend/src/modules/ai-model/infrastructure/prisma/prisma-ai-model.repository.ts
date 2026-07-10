import { Injectable } from '@nestjs/common';
import { OperationalStatus } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import {
  AiModelListFilter,
  AiModelRepositoryPort,
  buildAiModelWhere,
  CreateAiModelData,
  UpdateAiModelData,
} from '../../application/ports/ai-model.repository.port';

/**
 * Prisma-backed AiModelRegistry repository. Preserves the include shapes and
 * query filters from the former AiModelService.
 */
@Injectable()
export class PrismaAiModelRepository implements AiModelRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateAiModelData): Promise<any> {
    return this.prisma.aiModelRegistry.create({
      data: {
        modelName: data.modelName,
        modelVersion: data.modelVersion,
        recommendedSpecialty: data.recommendedSpecialty ?? null,
        type: data.type,
        provider: data.provider,
        apiEndpoint: data.apiEndpoint,
        ipHashEncrypted: data.ipHashEncrypted,
        ipHashPlain: data.ipHashPlain,
        description: data.description ?? null,
        createdBy: data.createdBy,
      },
      include: this.includeRelations(),
    });
  }

  async update(id: string, data: UpdateAiModelData): Promise<any> {
    return this.prisma.aiModelRegistry.update({
      where: { id },
      data: {
        ...(data.modelName !== undefined ? { modelName: data.modelName } : {}),
        ...(data.modelVersion !== undefined ? { modelVersion: data.modelVersion } : {}),
        ...(data.recommendedSpecialty !== undefined ? { recommendedSpecialty: data.recommendedSpecialty } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.provider !== undefined ? { provider: data.provider } : {}),
        ...(data.apiEndpoint !== undefined ? { apiEndpoint: data.apiEndpoint } : {}),
        ...(data.ipHashEncrypted !== undefined ? { ipHashEncrypted: data.ipHashEncrypted } : {}),
        ...(data.ipHashPlain !== undefined ? { ipHashPlain: data.ipHashPlain } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.isDeleted !== undefined ? { isDeleted: data.isDeleted } : {}),
      },
      include: this.includeRelations(),
    });
  }

  async softDelete(id: string): Promise<any> {
    return this.prisma.aiModelRegistry.update({
      where: { id },
      data: { status: OperationalStatus.DELETE, isDeleted: true },
      include: this.includeRelations(),
    });
  }

  async findAll(filter: AiModelListFilter): Promise<any[]> {
    return this.prisma.aiModelRegistry.findMany({
      where: buildAiModelWhere(filter),
      include: this.includeRelations(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async findManyPaginated(filter: AiModelListFilter, skip: number, take: number): Promise<{ items: any[]; total: number }> {
    const where = buildAiModelWhere(filter);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.aiModelRegistry.findMany({
        where,
        include: this.includeRelations(),
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.aiModelRegistry.count({ where }),
    ]);
    return { items, total };
  }

  async findByIdOrThrow(id: string): Promise<any> {
    return this.prisma.aiModelRegistry.findUniqueOrThrow({ where: { id }, include: this.includeRelations() });
  }

  async findById(id: string): Promise<any | null> {
    return this.prisma.aiModelRegistry.findUnique({ where: { id }, include: { _count: { select: { diagnoses: true, aiQualities: true } } } });
  }

  async findAllOrdered(): Promise<any[]> {
    return this.prisma.aiModelRegistry.findMany({ orderBy: { createdAt: 'desc' } });
  }

  private includeRelations() {
    return {
      aiQualities: {
        select: {
          trustablePercent: true,
        },
      },
      _count: { select: { diagnoses: true, aiQualities: true } },
    } as const;
  }
}

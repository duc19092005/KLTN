import { OperationalStatus, Prisma } from '@prisma/client';

/** DI token for the AI model repository port. */
export const AI_MODEL_REPOSITORY = Symbol('AI_MODEL_REPOSITORY');

export type CreateAiModelData = {
  modelName: string;
  modelVersion: string;
  recommendedSpecialty?: string | null;
  type: string;
  provider: string;
  apiEndpoint: string | null;
  ipHashEncrypted: string;
  ipHashPlain: string;
  description?: string | null;
  createdBy: string;
};

export type UpdateAiModelData = {
  modelName?: string;
  modelVersion?: string;
  recommendedSpecialty?: string | null;
  type?: string;
  provider?: string;
  apiEndpoint?: string | null;
  ipHashEncrypted?: string;
  ipHashPlain?: string;
  description?: string | null;
  status?: OperationalStatus;
  isDeleted?: boolean;
};

export type AiModelListFilter = {
  type?: string;
  search?: string;
  provider?: string;
  recommendedSpecialty?: string;
  includeDeleted?: boolean;
  status?: OperationalStatus;
};

/**
 * Persistence boundary for the AiModelRegistry aggregate. The Prisma
 * implementation keeps the include shapes and query filters unchanged.
 */
export interface AiModelRepositoryPort {
  create(data: CreateAiModelData): Promise<any>;
  update(id: string, data: UpdateAiModelData): Promise<any>;
  softDelete(id: string): Promise<any>;
  findAll(filter: AiModelListFilter): Promise<any[]>;
  findManyPaginated(filter: AiModelListFilter, skip: number, take: number): Promise<{ items: any[]; total: number }>;
  findByIdOrThrow(id: string): Promise<any>;
  findById(id: string): Promise<any | null>;
  findAllOrdered(): Promise<any[]>;
}

/** Builds the where clause for AI model listing, shared by repo internals. */
export function buildAiModelWhere(filter: AiModelListFilter): Prisma.AiModelRegistryWhereInput {
  return {
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.includeDeleted || filter.status ? {} : { status: { not: OperationalStatus.DELETE }, isDeleted: false }),
    ...(filter.type ? { type: filter.type } : {}),
    ...(filter.provider
      ? filter.provider === 'cloud'
        ? { provider: { notIn: ['local', 'ip'] } }
        : { provider: filter.provider }
      : {}),
    ...(filter.recommendedSpecialty ? { recommendedSpecialty: { equals: filter.recommendedSpecialty, mode: 'insensitive' } } : {}),
    ...(filter.search
      ? {
        OR: [
          { modelName: { contains: filter.search, mode: 'insensitive' } },
          { modelVersion: { contains: filter.search, mode: 'insensitive' } },
          { recommendedSpecialty: { contains: filter.search, mode: 'insensitive' } },
          { provider: { contains: filter.search, mode: 'insensitive' } },
        ],
      }
      : {}),
  };
}

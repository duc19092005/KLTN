import { Prisma } from '@prisma/client';

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

export type AiModelListFilter = {
  type?: string;
  search?: string;
};

/**
 * Persistence boundary for the AiModelRegistry aggregate. The Prisma
 * implementation keeps the include shapes and query filters unchanged.
 */
export interface AiModelRepositoryPort {
  create(data: CreateAiModelData): Promise<any>;
  findAll(filter: AiModelListFilter): Promise<any[]>;
  findByIdOrThrow(id: string): Promise<any>;
  findById(id: string): Promise<any | null>;
  findAllOrdered(): Promise<any[]>;
}

/** Builds the where clause for AI model listing, shared by repo internals. */
export function buildAiModelWhere(filter: AiModelListFilter): Prisma.AiModelRegistryWhereInput {
  return {
    ...(filter.type ? { type: filter.type } : {}),
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

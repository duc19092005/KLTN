import { BadRequestException, Injectable } from '@nestjs/common';
import { createCipheriv, createHash, randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CreateAiModelDto, AiModelQueryDto } from '../dto/ai-model.dto';

@Injectable()
export class AiModelService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAiModelDto, adminUserId: string) {
    if (dto.type === 'API' && !dto.provider) {
      throw new BadRequestException('Provider is required when adding AI model by API');
    }
    if (dto.type === 'API' && !dto.apiEndpoint?.trim()) {
      throw new BadRequestException('API endpoint is required when adding AI model by API');
    }

    const encrypted = this.encryptAes256(dto.secretOrIpHash);
    const plainFingerprint = this.createFingerprint(dto.secretOrIpHash);

    return this.prisma.aiModelRegistry.create({
      data: {
        modelName: dto.modelName.trim(),
        modelVersion: dto.modelVersion.trim(),
        recommendedSpecialty: dto.recommendedSpecialty?.trim() || null,
        type: dto.type,
        provider: dto.type === 'API' ? dto.provider || 'other' : 'ip',
        apiEndpoint: dto.type === 'API' ? dto.apiEndpoint?.trim() || null : null,
        ipHashEncrypted: encrypted,
        ipHashPlain: plainFingerprint,
        description: dto.description?.trim() || null,
        createdBy: adminUserId,
      },
      include: this.includeRelations(),
    });
  }

  async findAll(query: AiModelQueryDto) {
    const where: Prisma.AiModelRegistryWhereInput = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.search ? {
        OR: [
          { modelName: { contains: query.search, mode: 'insensitive' } },
          { modelVersion: { contains: query.search, mode: 'insensitive' } },
          { recommendedSpecialty: { contains: query.search, mode: 'insensitive' } },
          { provider: { contains: query.search, mode: 'insensitive' } },
        ],
      } : {}),
    };

    return this.prisma.aiModelRegistry.findMany({
      where,
      include: this.includeRelations(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.aiModelRegistry.findUniqueOrThrow({
      where: { id },
      include: this.includeRelations(),
    });
  }

  private encryptAes256(value: string) {
    const rawKey = process.env.ENCRYPTION_KEY;
    if (!rawKey) throw new BadRequestException('ENCRYPTION_KEY is not configured');

    const key = Buffer.from(rawKey, 'hex');
    if (key.length !== 32) throw new BadRequestException('ENCRYPTION_KEY must be 32 bytes hex for AES-256');

    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
  }

  private createFingerprint(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private includeRelations() {
    return {
      _count: { select: { diagnoses: true, aiQualities: true } },
    } as const;
  }
}

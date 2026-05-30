import { BadRequestException, Injectable } from '@nestjs/common';
import { createCipheriv, createHash, randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CreateAiModelDto, AiModelQueryDto, TestAiModelApiDto } from '../dto/ai-model.dto';

@Injectable()
export class AiModelService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAiModelDto, adminUserId: string) {
    if (dto.type === 'API' && !dto.provider) {
      throw new BadRequestException('Provider is required when adding AI model by API');
    }
    const apiEndpoint = dto.type === 'API' ? this.resolveApiEndpoint(dto.provider || 'other', dto.apiEndpoint, dto.modelVersion) : null;

    const encrypted = this.encryptAes256(dto.secretOrIpHash);
    const plainFingerprint = this.createFingerprint(dto.secretOrIpHash);

    return this.prisma.aiModelRegistry.create({
      data: {
        modelName: dto.modelName.trim(),
        modelVersion: dto.modelVersion.trim(),
        recommendedSpecialty: dto.recommendedSpecialty?.trim() || null,
        type: dto.type,
        provider: dto.type === 'API' ? dto.provider || 'other' : 'ip',
        apiEndpoint,
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

  async testApi(dto: TestAiModelApiDto) {
    const endpoint = this.resolveApiEndpoint(dto.provider, dto.apiEndpoint, dto.modelVersion);
    const provider = dto.provider.toLowerCase();
    const startedAt = Date.now();

    try {
      if (provider === 'gemini') await this.testGemini(endpoint, dto.secretOrIpHash, dto.modelVersion);
      else await this.testOpenAiCompatible(endpoint, dto.secretOrIpHash, dto.modelVersion);
      return { ok: true, provider: dto.provider, endpoint, latencyMs: Date.now() - startedAt, message: 'API provider hoạt động.' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown API test error';
      throw new BadRequestException(`API test failed: ${message}`);
    }
  }

  private resolveApiEndpoint(provider: string, customEndpoint?: string, modelVersion?: string) {
    if (customEndpoint?.trim()) return customEndpoint.trim();
    const model = modelVersion?.trim() || 'gemini-2.5-flash';
    const map: Record<string, string> = {
      chatgpt: 'https://api.openai.com/v1/chat/completions',
      deepseek: 'https://api.deepseek.com/chat/completions',
      qwen: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
      anthropic: 'https://api.anthropic.com/v1/messages',
      gemini: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    };
    const endpoint = map[provider.toLowerCase()];
    if (!endpoint) throw new BadRequestException('Custom API endpoint is required for provider other');
    return endpoint;
  }

  private async testOpenAiCompatible(endpoint: string, token: string, modelVersion: string) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ model: modelVersion, messages: [{ role: 'user', content: 'ping' }], max_tokens: 8, temperature: 0 }),
    });
    if (!response.ok) throw new Error(await this.readProviderError(response));
  }

  private async testGemini(endpoint: string, token: string, modelVersion: string) {
    const url = endpoint.includes(':generateContent') ? endpoint.replace(/models\/[^/:]+:generateContent/, `models/${modelVersion}:generateContent`) : endpoint;
    const withKey = new URL(url);
    if (!withKey.searchParams.has('key')) withKey.searchParams.set('key', token);
    const response = await fetch(withKey.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'ping' }] }], generationConfig: { maxOutputTokens: 8, temperature: 0 } }),
    });
    if (!response.ok) throw new Error(await this.readProviderError(response));
  }

  private async readProviderError(response: Response) {
    const text = await response.text();
    try {
      const json = JSON.parse(text);
      return json?.error?.message || json?.message || text;
    } catch {
      return text || `HTTP ${response.status}`;
    }
  }

  private encryptAes256(value: string) {
    const rawKey = process.env.ENCRYPTION_KEY;
    if (!rawKey) throw new BadRequestException('ENCRYPTION_KEY is not configured');

    const key = Buffer.from(rawKey, 'hex');
    if (key.length !== 32) throw new BadRequestException('ENCRYPTION_KEY must be 32 bytes hex for AES-256');

    // AES-256-GCM: authenticated encryption. The auth tag lets decryption detect
    // tampering/corruption, which plain CBC cannot. Stored as v1:ivHex:tagHex:cipherHex.
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
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

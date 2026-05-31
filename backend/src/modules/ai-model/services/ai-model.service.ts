import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createCipheriv, createHash, randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { BlockchainService } from '../../../infrastructure/blockchain/blockchain.service';
import { AuditLoggerService, AuditAction } from '../../../infrastructure/audit/audit-logger.service';
import { hashToBytes32 } from '../../../infrastructure/audit/audit-hash.util';
import { CreateAiModelDto, AiModelQueryDto, TestAiModelApiDto } from '../dto/ai-model.dto';

@Injectable()
export class AiModelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchain: BlockchainService,
    private readonly audit: AuditLoggerService,
  ) {}

  async create(dto: CreateAiModelDto, adminUserId: string) {
    if (dto.type === 'API' && !dto.provider) {
      throw new BadRequestException('Provider is required when adding AI model by API');
    }
    const apiEndpoint = dto.type === 'API' ? this.resolveApiEndpoint(dto.provider || 'other', dto.apiEndpoint, dto.modelVersion) : null;

    // Local/self-hosted models (Llama, Ollama, vLLM) often need no API key. When the key is
    // omitted, use the endpoint (or model id) as the identity material so each model still gets
    // a unique AES blob + fingerprint. ipHashEncrypted is NOT NULL, so we always store something.
    const secretMaterial = dto.secretOrIpHash?.trim() || apiEndpoint || dto.modelVersion.trim();
    const encrypted = this.encryptAes256(secretMaterial);
    const plainFingerprint = this.createFingerprint(secretMaterial);

    const model = await this.prisma.aiModelRegistry.create({
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

    await this.anchorAiModelChange(model, 'CREATE', adminUserId, null);
    return model;
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
    const model = await this.prisma.aiModelRegistry.findUniqueOrThrow({
      where: { id },
      include: this.includeRelations(),
    });
    const integrity = await this.evaluateIntegrity(model);
    return {
      ...model,
      audit: {
        status: integrity.status,
        dbMatches: integrity.dbMatches,
        chainMatches: integrity.chainMatches,
        onChainHash: integrity.onChainHash,
        storedHash: integrity.storedHash,
        recomputedHash: integrity.recomputedHash,
      },
    };
  }


  async testApi(dto: TestAiModelApiDto) {
    const endpoint = this.resolveApiEndpoint(dto.provider, dto.apiEndpoint, dto.modelVersion);
    const provider = dto.provider.toLowerCase();
    const startedAt = Date.now();

    try {
      if (provider === 'gemini') await this.testGemini(endpoint, dto.secretOrIpHash || '', dto.modelVersion);
      else await this.testOpenAiCompatible(endpoint, dto.secretOrIpHash || '', dto.modelVersion);
      return { ok: true, provider: dto.provider, endpoint, latencyMs: Date.now() - startedAt, message: 'API provider hoạt động.' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown API test error';
      throw new BadRequestException(`API test failed: ${message}`);
    }
  }

  // ---- Tamper-evidence helpers ------------------------------------------------

  /** Business fields included in the integrity hash. */
  private buildSnapshot(m: any) {
    return {
      modelName: m.modelName,
      modelVersion: m.modelVersion,
      recommendedSpecialty: m.recommendedSpecialty ?? null,
      type: m.type ?? null,
      provider: m.provider ?? null,
      apiEndpoint: m.apiEndpoint ?? null,
      ipHashPlain: m.ipHashPlain ?? null,
      description: m.description ?? null,
      createdBy: m.createdBy,
    };
  }

  /**
   * Compute the integrity hash, mirror on-chain (AIModelRegistry),
   * persist hash256/dataSalt on the row, and write a BlockchainLogger entry.
   */
  private async anchorAiModelChange(model: any, action: AuditAction, actorId?: string, before?: unknown) {
    const snapshot = this.buildSnapshot(model);
    let dataHash: string | null = null;
    let dataSalt: string | null = null;
    let onChainStatus = 'PENDING';
    let txHash: string | null = null;
    let blockNumber: number | null = null;

    try {
      if (action === 'DELETE') {
        const res = await this.blockchain.removeAiModelHash(model.id);
        onChainStatus = res.success ? 'ANCHORED' : 'UNANCHORED';
        txHash = (res as any).txHash ?? null;
        blockNumber = (res as any).blockNumber ?? null;
      } else {
        const { salt, hash } = this.audit.hashSnapshot(snapshot);
        dataHash = hash;
        dataSalt = salt;
        await this.prisma.aiModelRegistry.update({ where: { id: model.id }, data: { hash256: hash, dataSalt: salt } });
        const res = await this.blockchain.setAiModelHash(model.id, hashToBytes32(hash));
        onChainStatus = res.success ? 'ANCHORED' : 'UNANCHORED';
        txHash = (res as any).txHash ?? null;
        blockNumber = (res as any).blockNumber ?? null;
      }
    } catch {
      onChainStatus = 'UNANCHORED';
    }

    await this.audit.record({
      entity: 'AiModelRegistry',
      entityId: model.id,
      action,
      actorId,
      dataHash,
      dataSalt,
      before: before ?? null,
      after: action === 'DELETE' ? null : snapshot,
      onChainStatus,
      txHash,
      blockNumber,
    });
  }

  /** Change history for an AI model. */
  getHistory(id?: string) {
    return this.audit.history('AiModelRegistry', id);
  }

  /** Verify an AI model's integrity against on-chain hash. */
  async verifyAiModel(id: string) {
    const model = await this.prisma.aiModelRegistry.findUnique({ where: { id } });
    if (!model) throw new NotFoundException('AI model not found');
    return this.evaluateIntegrity(model);
  }

  /** Verify all AI models. */
  async verifyAll() {
    const models = await this.prisma.aiModelRegistry.findMany({ orderBy: { createdAt: 'desc' } });
    const items = await Promise.all(models.map((m) => this.evaluateIntegrity(m)));
    const summary = items.reduce(
      (acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    return { total: items.length, summary, items };
  }

  private async evaluateIntegrity(model: any) {
    const snapshot = this.buildSnapshot(model);
    const recomputed = model.dataSalt ? this.audit.recompute(snapshot, model.dataSalt) : null;
    const dbHash = model.hash256 || null;
    const onChain = await this.blockchain.getAiModelHash(model.id);
    const onChainNormalized = onChain ? onChain.toLowerCase() : null;
    const recomputedBytes32 = recomputed ? hashToBytes32(recomputed).toLowerCase() : null;

    const dbMatches = recomputed !== null && recomputed === dbHash;
    const chainMatches = recomputedBytes32 !== null && recomputedBytes32 === onChainNormalized;

    let status: 'VERIFIED' | 'TAMPERED' | 'UNANCHORED';
    if (!onChainNormalized) status = 'UNANCHORED';
    else if (chainMatches) status = 'VERIFIED';
    else status = 'TAMPERED';

    return {
      id: model.id,
      modelName: model.modelName,
      modelVersion: model.modelVersion,
      status,
      dbMatches,
      chainMatches,
      recomputedHash: recomputed,
      storedHash: dbHash,
      onChainHash: onChain,
    };
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
    // local (self-hosted Llama/Ollama/vLLM) and other (custom) have no preset URL: the admin
    // must supply the endpoint explicitly.
    if (!endpoint) {
      throw new BadRequestException(
        'Vui lòng nhập API Endpoint cho model tự host / tùy chỉnh (ví dụ http://localhost:11434/v1/chat/completions).',
      );
    }
    return endpoint;
  }

  private async testOpenAiCompatible(endpoint: string, token: string, modelVersion: string) {
    // Token is optional: local OpenAI-compatible servers (Ollama, vLLM) usually accept no auth.
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
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

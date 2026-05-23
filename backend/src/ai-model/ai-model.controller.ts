import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { AiModelService } from './ai-model.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RegisterModelDto } from './dto/register-model.dto';
import { AddHashDto } from './dto/add-hash.dto';
import { VerifyHashDto } from './dto/verify-hash.dto';

@Controller('ai-model')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiModelController {
  constructor(private readonly aiModelService: AiModelService) {}

  /**
   * POST /ai-model/register
   * Register a new AI model with IP hash
   * Admin only
   */
  @Post('register')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async registerModel(@Body() dto: RegisterModelDto, @Request() req) {
    const adminId = req.user.sub;
    return this.aiModelService.registerModel(dto, adminId);
  }

  /**
   * GET /ai-model/list
   * List all registered AI models
   * Admin only
   */
  @Get('list')
  @Roles('ADMIN')
  async listModels() {
    return this.aiModelService.listModels();
  }

  /**
   * GET /ai-model/config
   * Get AI Model configuration (including contract address)
   * Admin only
   */
  @Get('config')
  @Roles('ADMIN')
  async getConfig() {
    return {
      aiModelRegistryAddress: process.env.AI_MODEL_REGISTRY_ADDRESS,
    };
  }

  /**
   * GET /ai-model/:modelId
   * Get details of a specific model
   * Admin only
   */
  @Get(':modelId')
  @Roles('ADMIN')
  async getModel(@Param('modelId') modelId: string) {
    return this.aiModelService.getModel(modelId);
  }

  /**
   * POST /ai-model/update/:modelId
   * Update metadata/config of a model
   * Admin only
   */
  @Post('update/:modelId')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  async updateModel(
    @Param('modelId') modelId: string,
    @Body() dto: {
      modelName?: string;
      modelVersion?: string;
      recommendedSpecialty?: string;
      description?: string;
      type?: string;
      ipHash?: string;
    }
  ) {
    return this.aiModelService.updateModel(modelId, dto);
  }

  /**
   * POST /ai-model/verify-hash
   * Verify if an IP hash is valid for a model
   * Can be used by system to verify model authenticity
   */
  @Post('verify-hash')
  @Roles('ADMIN', 'DOCTOR')
  @HttpCode(HttpStatus.OK)
  async verifyHash(@Body() dto: VerifyHashDto) {
    return this.aiModelService.verifyHash(dto);
  }

  /**
   * POST /ai-model/add-hash
   * Add/update IP hash for a model
   * Admin only
   */
  @Post('add-hash')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  async addHash(@Body() dto: AddHashDto, @Request() req) {
    const adminId = req.user.sub;
    return this.aiModelService.addHash(dto, adminId);
  }

  /**
   * POST /ai-model/:modelId/blockchain-status
   * Update blockchain registration status
   * Admin only
   */
  @Post(':modelId/blockchain-status')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  async updateBlockchainStatus(
    @Param('modelId') modelId: string,
    @Body('txHash') txHash: string,
    @Body('isActiveOnChain') isActiveOnChain?: boolean,
  ) {
    const active = isActiveOnChain !== undefined ? isActiveOnChain : true;
    return this.aiModelService.updateBlockchainStatus(modelId, txHash, active);
  }

  /**
   * POST /ai-model/:modelId/clear-plain-hash
   * Clear plain IP hash after admin has saved it
   * Admin only
   */
  @Post(':modelId/clear-plain-hash')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  async clearPlainHash(@Param('modelId') modelId: string) {
    await this.aiModelService.clearPlainHash(modelId);
    return { message: 'Plain hash cleared successfully' };
  }

  /**
   * GET /ai-model/:modelId/blockchain-hash
   * Get hashed IP for blockchain operations
   * Admin only
   */
  @Get(':modelId/blockchain-hash')
  @Roles('ADMIN')
  async getBlockchainHash(@Param('modelId') modelId: string) {
    return this.aiModelService.getDecryptedHash(modelId);
  }

  /**
   * GET /ai-model/:modelId/plain-hash
   * Get decrypted plain IP hash / API config for editing
   * Admin only
   */
  @Get(':modelId/plain-hash')
  @Roles('ADMIN')
  async getPlainHash(@Param('modelId') modelId: string) {
    return this.aiModelService.getPlainHash(modelId);
  }

  /**
   * POST /ai-model/test-provider
   * Test API Key connection to the selected AI provider
   * Admin only
   */
  @Post('test-provider')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  async testProvider(
    @Body('provider') provider: string,
    @Body('apiKey') apiKey: string,
    @Body('baseUrl') baseUrl?: string,
  ) {
    if (!provider || !apiKey) {
      throw new BadRequestException('provider and apiKey are required');
    }

    try {
      let url = '';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (provider === 'openai') {
        const base = baseUrl ? baseUrl.replace(/\/$/, '') : 'https://api.openai.com/v1';
        url = `${base}/models`;
        headers['Authorization'] = `Bearer ${apiKey}`;
      } else if (provider === 'anthropic') {
        const base = baseUrl ? baseUrl.replace(/\/$/, '') : 'https://api.anthropic.com/v1';
        url = `${base}/models`;
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
      } else if (provider === 'gemini') {
        const base = baseUrl ? baseUrl.replace(/\/$/, '') : 'https://generativelanguage.googleapis.com/v1beta';
        url = `${base}/models?key=${apiKey}`;
      } else if (provider === 'deepseek') {
        const base = baseUrl ? baseUrl.replace(/\/$/, '') : 'https://api.deepseek.com';
        url = `${base}/models`;
        headers['Authorization'] = `Bearer ${apiKey}`;
      } else {
        throw new BadRequestException(`Unsupported provider: ${provider}`);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 seconds timeout

      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          status: response.status,
          message: `Lỗi từ nhà cung cấp: ${response.statusText} (${errorText.substring(0, 100)})`,
        };
      }

      return {
        success: true,
        message: 'Kết nối thành công! API Key hợp lệ.',
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Không thể kết nối đến nhà cung cấp: ${err.message || err}`,
      };
    }
  }
}

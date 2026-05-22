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
    const adminId = req.user.userId;
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
    const adminId = req.user.userId;
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
  ) {
    return this.aiModelService.updateBlockchainStatus(modelId, txHash);
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
}

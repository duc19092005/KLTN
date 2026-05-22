import {
  Controller,
  Post,
  Get,
  Query,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AiModelService } from './ai-model.service';
import { BlockchainService } from '../blockchain/blockchain.service';

@Controller('ai-model/blockchain')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AiModelBlockchainController {
  constructor(
    private readonly aiModelService: AiModelService,
    private readonly blockchainService: BlockchainService,
  ) {}

  /**
   * POST /ai-model/blockchain/register/:modelId
   * Register AI model on blockchain
   * This combines database and blockchain operations
   */
  @Post('register/:modelId')
  @HttpCode(HttpStatus.OK)
  async registerOnBlockchain(@Param('modelId') modelId: string) {
    // Get model from database
    const model = await this.aiModelService.getModel(modelId);

    if (model.isActiveOnChain) {
      throw new BadRequestException('Model already registered on blockchain');
    }

    // Get hashed IP for blockchain
    const { ipHashForBlockchain } = await this.aiModelService.getDecryptedHash(modelId);

    // Register on blockchain
    const result = await this.blockchainService.registerAiModel(
      model.modelId,
      ipHashForBlockchain,
    );

    if (!result.success) {
      throw new BadRequestException(`Blockchain registration failed: ${result.error}`);
    }

    // Update database with blockchain status
    await this.aiModelService.updateBlockchainStatus(modelId, result.txHash);

    return {
      message: 'Model registered on blockchain successfully',
      modelId: model.modelId,
      txHash: result.txHash,
      blockNumber: result.blockNumber,
    };
  }

  /**
   * POST /ai-model/blockchain/add-hash/:modelId
   * Add new IP hash to blockchain for existing model
   */
  @Post('add-hash/:modelId')
  @HttpCode(HttpStatus.OK)
  async addHashOnBlockchain(
    @Param('modelId') modelId: string,
    @Body('ipHash') ipHash: string,
  ) {
    if (!ipHash) {
      throw new BadRequestException('ipHash is required');
    }

    // Keep database encrypted copy in sync before adding the SHA-256 fingerprint on-chain.
    const { ipHashForBlockchain } = await this.aiModelService.addHash(
      { modelId, ipHash },
      'blockchain-admin',
    );

    // Add to blockchain
    const result = await this.blockchainService.addAiModelHash(modelId, ipHashForBlockchain);

    if (!result.success) {
      throw new BadRequestException(`Failed to add hash on blockchain: ${result.error}`);
    }

    await this.aiModelService.updateBlockchainStatus(modelId, result.txHash);

    return {
      message: 'Hash added on blockchain successfully',
      modelId,
      txHash: result.txHash,
      blockNumber: result.blockNumber,
    };
  }

  /**
   * POST /ai-model/blockchain/deactivate-hash/:modelId
   * Deactivate IP hash on blockchain
   */
  @Post('deactivate-hash/:modelId')
  @HttpCode(HttpStatus.OK)
  async deactivateHashOnBlockchain(
    @Param('modelId') modelId: string,
    @Body('ipHash') ipHash: string,
  ) {
    if (!ipHash) {
      throw new BadRequestException('ipHash is required');
    }

    const ipHashForBlockchain = this.aiModelService.hashForBlockchain(ipHash);

    const result = await this.blockchainService.deactivateAiModelHash(
      modelId,
      ipHashForBlockchain,
    );

    if (!result.success) {
      throw new BadRequestException(`Failed to deactivate hash: ${result.error}`);
    }

    return {
      message: 'Hash deactivated on blockchain successfully',
      modelId,
      txHash: result.txHash,
    };
  }

  /**
   * POST /ai-model/blockchain/verify/:modelId
   * Verify model hash on blockchain
   */
  @Post('verify/:modelId')
  @HttpCode(HttpStatus.OK)
  async verifyOnBlockchain(
    @Param('modelId') modelId: string,
    @Body('ipHash') ipHash: string,
  ) {
    if (!ipHash) {
      throw new BadRequestException('ipHash is required');
    }

    const ipHashForBlockchain = this.aiModelService.hashForBlockchain(ipHash);

    const isActive = await this.blockchainService.isAiModelHashActive(
      modelId,
      ipHashForBlockchain,
    );

    return {
      modelId,
      isActive,
      message: isActive ? 'Hash is active on blockchain' : 'Hash is not active',
    };
  }

  /**
   * GET /ai-model/blockchain/verify/:modelId?ipHash=...
   * Convenience read endpoint for clients that prefer query params.
   */
  @Get('verify/:modelId')
  async verifyOnBlockchainByQuery(
    @Param('modelId') modelId: string,
    @Query('ipHash') ipHash: string,
  ) {
    return this.verifyOnBlockchain(modelId, ipHash);
  }

}

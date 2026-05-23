import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../encryption/encryption.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { RegisterModelDto } from './dto/register-model.dto';
import { AddHashDto } from './dto/add-hash.dto';
import { VerifyHashDto } from './dto/verify-hash.dto';

@Injectable()
export class AiModelService {
  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
    private blockchainService: BlockchainService,
  ) {}

  /**
   * Register a new AI model with IP hash
   * - Encrypts IP hash before storing in database
   * - Returns plain IP hash only once (for admin to save)
   * - Prepares data for blockchain registration
   */
  async registerModel(dto: RegisterModelDto, createdBy: string) {
    const modelId = dto.modelId?.trim();

    if (modelId) {
      // Check if caller-provided model ID already exists
      const existing = await this.prisma.aiModelRegistry.findUnique({
        where: { modelId },
      });

      if (existing) {
        throw new BadRequestException('Model ID already exists');
      }
    }

    // Encrypt IP hash
    const ipHashEncrypted = this.encryption.encrypt(dto.ipHash);

    // Hash the IP for blockchain (using SHA-256)
    const ipHashForBlockchain = this.encryption.hash(dto.ipHash);

    // Create model in database
    const model = await this.prisma.aiModelRegistry.create({
      data: {
        ...(modelId ? { modelId } : {}),
        modelName: dto.modelName,
        modelVersion: dto.modelVersion,
        recommendedSpecialty: dto.recommendedSpecialty,
        ipHashEncrypted,
        ipHashPlain: dto.ipHash, // Store temporarily, will be cleared after first read
        description: dto.description,
        createdBy,
        isActiveOnChain: false,
        type: dto.type,
      },
    });

    return {
      id: model.id,
      modelId: model.modelId,
      modelName: model.modelName,
      modelVersion: model.modelVersion,
      recommendedSpecialty: model.recommendedSpecialty,
      ipHashPlain: model.ipHashPlain, // Return plain hash ONLY ONCE
      ipHashForBlockchain, // Hash to register on blockchain
      description: model.description,
      createdAt: model.createdAt,
      message: 'Model registered successfully. Save the ipHashPlain - it will not be shown again!',
    };
  }

  /**
   * Get model details (without plain IP hash)
   */
  async getModel(modelId: string) {
    const model = await this.prisma.aiModelRegistry.findUnique({
      where: { modelId },
    });

    if (!model) {
      throw new NotFoundException('Model not found');
    }

    let integrityVerified = false;
    let blockchainHash = null;
    let errorLog = null;

    if (model.isActiveOnChain && this.blockchainService.aiModelContract) {
      try {
        const [onChainHash, onChainActive] = await this.blockchainService.aiModelContract.getModelDetails(model.modelId);
        blockchainHash = onChainHash;

        if (onChainActive && onChainHash) {
          const decryptedHash = this.encryption.decrypt(model.ipHashEncrypted);
          const computedHash = this.encryption.hash(decryptedHash);
          if (computedHash === onChainHash) {
            integrityVerified = true;
          }
        }
      } catch (err) {
        console.error('Blockchain integrity check failed:', err);
        errorLog = err.message;
      }
    }

    return {
      id: model.id,
      modelId: model.modelId,
      modelName: model.modelName,
      modelVersion: model.modelVersion,
      recommendedSpecialty: model.recommendedSpecialty,
      description: model.description,
      isActiveOnChain: model.isActiveOnChain,
      blockchainTxHash: model.blockchainTxHash,
      createdBy: model.createdBy,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
      type: model.type,
      integrityVerified,
      blockchainHash,
      verificationError: errorLog,
    };
  }

  /**
   * List all registered models
   */
  async listModels() {
    const models = await this.prisma.aiModelRegistry.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return models.map((model) => ({
      id: model.id,
      modelId: model.modelId,
      modelName: model.modelName,
      modelVersion: model.modelVersion,
      recommendedSpecialty: model.recommendedSpecialty,
      description: model.description,
      isActiveOnChain: model.isActiveOnChain,
      blockchainTxHash: model.blockchainTxHash,
      type: model.type,
      createdBy: model.createdBy,
      createdAt: model.createdAt,
    }));
  }

  /**
   * Verify if an IP hash is valid for a model
   * - Decrypts stored hash and compares with provided hash
   */
  async verifyHash(dto: VerifyHashDto) {
    const model = await this.prisma.aiModelRegistry.findUnique({
      where: { modelId: dto.modelId },
    });

    if (!model) {
      throw new NotFoundException('Model not found');
    }

    try {
      // Decrypt stored hash
      const decryptedHash = this.encryption.decrypt(model.ipHashEncrypted);

      // Compare with provided hash
      const isValid = decryptedHash === dto.ipHash;

      return {
        modelId: dto.modelId,
        isValid,
        isActiveOnChain: model.isActiveOnChain,
      };
    } catch (error) {
      throw new BadRequestException('Failed to verify hash');
    }
  }

  /**
   * Add a new IP hash for existing model (for model updates/versions)
   * This would require updating the blockchain as well
   */
  async addHash(dto: AddHashDto, adminId: string) {
    const model = await this.prisma.aiModelRegistry.findUnique({
      where: { modelId: dto.modelId },
    });

    if (!model) {
      throw new NotFoundException('Model not found');
    }

    // For now, we'll update the existing hash
    // In production, you might want to store multiple hashes
    const ipHashEncrypted = this.encryption.encrypt(dto.ipHash);
    const ipHashForBlockchain = this.encryption.hash(dto.ipHash);

    const updated = await this.prisma.aiModelRegistry.update({
      where: { modelId: dto.modelId },
      data: {
        ipHashEncrypted,
        isActiveOnChain: false, // Need to re-register on blockchain
        blockchainTxHash: null,
      },
    });

    return {
      modelId: updated.modelId,
      ipHashForBlockchain,
      message: 'Hash updated. Please register on blockchain again.',
    };
  }

  /**
   * Build the deterministic SHA-256 value stored on-chain.
   * AES protects the endpoint in the database; SHA-256 is the public blockchain fingerprint.
   */
  hashForBlockchain(ipHash: string) {
    return this.encryption.hash(ipHash);
  }

  /**
   * Update blockchain transaction hash after successful on-chain registration
   */
  async updateBlockchainStatus(modelId: string, txHash: string, isActiveOnChain: boolean = true) {
    const model = await this.prisma.aiModelRegistry.findUnique({
      where: { modelId },
    });

    if (!model) {
      throw new NotFoundException('Model not found');
    }

    await this.prisma.aiModelRegistry.update({
      where: { modelId },
      data: {
        blockchainTxHash: txHash,
        isActiveOnChain,
      },
    });

    return {
      modelId,
      txHash,
      message: 'Blockchain status updated successfully',
    };
  }

  /**
   * Clear plain IP hash after first read (security measure)
   */
  async clearPlainHash(modelId: string) {
    await this.prisma.aiModelRegistry.update({
      where: { modelId },
      data: { ipHashPlain: null },
    });
  }

  /**
   * Get decrypted IP hash (admin only, for blockchain operations)
   */
  async getDecryptedHash(modelId: string) {
    const model = await this.prisma.aiModelRegistry.findUnique({
      where: { modelId },
    });

    if (!model) {
      throw new NotFoundException('Model not found');
    }

    try {
      const decryptedHash = this.encryption.decrypt(model.ipHashEncrypted);
      const hashedForBlockchain = this.encryption.hash(decryptedHash);

      return {
        modelId: model.modelId,
        ipHashForBlockchain: hashedForBlockchain,
      };
    } catch (error) {
      throw new BadRequestException('Failed to decrypt hash');
    }
  }

  /**
   * Update AI model metadata/configuration details in DB
   */
  async updateModel(modelId: string, dto: {
    modelName?: string;
    modelVersion?: string;
    recommendedSpecialty?: string;
    description?: string;
    type?: string;
    ipHash?: string;
  }) {
    const existing = await this.prisma.aiModelRegistry.findUnique({
      where: { modelId },
    });

    if (!existing) {
      throw new NotFoundException('Model not found');
    }

    const updateData: any = {
      modelName: dto.modelName !== undefined ? dto.modelName : existing.modelName,
      modelVersion: dto.modelVersion !== undefined ? dto.modelVersion : existing.modelVersion,
      recommendedSpecialty: dto.recommendedSpecialty !== undefined ? dto.recommendedSpecialty : existing.recommendedSpecialty,
      description: dto.description !== undefined ? dto.description : existing.description,
      type: dto.type !== undefined ? dto.type : existing.type,
    };

    if (dto.ipHash !== undefined && dto.ipHash.trim() !== '') {
      updateData.ipHashEncrypted = this.encryption.encrypt(dto.ipHash);
      updateData.ipHashPlain = dto.ipHash;
      updateData.isActiveOnChain = false;
    }

    const updated = await this.prisma.aiModelRegistry.update({
      where: { modelId },
      data: updateData,
    });

    return updated;
  }

  /**
   * Decrypt and return the plain IP/API Key config (admin only, for editing purposes)
   */
  async getPlainHash(modelId: string) {
    const model = await this.prisma.aiModelRegistry.findUnique({
      where: { modelId },
    });
    if (!model) {
      throw new NotFoundException('Model not found');
    }
    try {
      const plainHash = this.encryption.decrypt(model.ipHashEncrypted);
      return { plainHash };
    } catch (err) {
      throw new BadRequestException('Failed to decrypt plain hash');
    }
  }
}

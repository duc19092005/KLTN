import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { BlockchainService } from '../../infrastructure/blockchain/blockchain.service';
import { CHECK_ENTITY_INTEGRITY_KEY, CheckEntityIntegrityOptions } from '../decorators/check-entity-integrity.decorator';
import { computeMerkleRootForAlgorithm, MERKLE_SHA256_STRING_V1, rootToBytes32 } from '../../infrastructure/audit';

@Injectable()
export class EntityIntegrityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly blockchain: BlockchainService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<CheckEntityIntegrityOptions>(
      CHECK_ENTITY_INTEGRITY_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If decorator not present, allow request by default
    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const paramKey = options.paramKey || 'id';
    const entityId = request.params?.[paramKey] || request.body?.[paramKey];

    if (!entityId) {
      return true;
    }

    // Find the latest audit log entry for this entity to get its batchId
    const latestLog = await this.prisma.blockchainLogger.findFirst({
      where: {
        ...(options.entity ? { entity: options.entity } : {}),
        entityId: String(entityId),
      },
      orderBy: { seq: 'desc' },
      select: { batchId: true, entity: true },
    });

    if (!latestLog || !latestLog.batchId) {
      return true;
    }

    const batchId = latestLog.batchId;

    // 1. Check if local AuditBatch exists in DB
    const localBatch = await this.prisma.auditBatch.findUnique({
      where: { batchId },
      select: {
        batchId: true,
        merkleRoot: true,
        status: true,
        fromSeq: true,
        toSeq: true,
        leafCount: true,
        algorithmVersion: true,
      },
    });

    // 2. Fetch Blockchain checkpoint
    let checkpoint;
    try {
      checkpoint = await this.blockchain.getAuditCheckpoint(batchId);
    } catch {
      // If blockchain query fails, proceed gracefully
      return true;
    }

    if (!checkpoint || !checkpoint.committed) {
      return true;
    }

    // Check 1: If AuditBatch row was deleted from local DB
    if (!localBatch) {
      throw new HttpException(
        `🛑 Thao tác bị từ chối! Dữ liệu của đối tượng thuộc Lô #${batchId} đã bị XÓA khỏi Database local. Hệ thống đã tự động KHÓA thao tác Chỉnh sửa/Xóa để bảo vệ an toàn Y tế. Vui lòng bấm Khôi phục dữ liệu từ Blockchain trước khi thao tác!`,
        423,
      );
    }

    // Check 2: Compare local Merkle root vs on-chain Merkle root
    if (rootToBytes32(localBatch.merkleRoot).toLowerCase() !== rootToBytes32(checkpoint.root).toLowerCase()) {
      throw new HttpException(
        `🛑 Thao tác bị từ chối! Lô #${batchId} chứa dữ liệu này đang có cảnh báo SAI LỆCH Merkle Root giữa Local và Blockchain. Hệ thống đã tự động KHÓA thao tác để bảo vệ dữ liệu. Vui lòng khôi phục từ Blockchain trước!`,
        423,
      );
    }

    // Check 3: Verify local log entries count and Merkle root recomputation
    if (localBatch.fromSeq != null && localBatch.toSeq != null) {
      const logs = await this.prisma.blockchainLogger.findMany({
        where: { seq: { gte: localBatch.fromSeq, lte: localBatch.toSeq }, entryHash: { not: null } },
        select: { entryHash: true },
      });

      const expectedCount = Number(checkpoint.leafCount) || localBatch.leafCount || (localBatch.toSeq - localBatch.fromSeq + 1);

      if (logs.length !== expectedCount) {
        throw new HttpException(
          `🛑 Thao tác bị từ chối! Lô #${batchId} bị đứt gãy hoặc thiếu bản ghi nhật ký. Hệ thống đã tự động KHÓA thao tác để bảo vệ an toàn Y tế. Vui lòng khôi phục từ Blockchain trước!`,
          423,
        );
      }

      const recomputedRoot = computeMerkleRootForAlgorithm(
        logs.map((l) => l.entryHash!),
        localBatch.algorithmVersion ?? MERKLE_SHA256_STRING_V1,
      );

      if (rootToBytes32(recomputedRoot).toLowerCase() !== rootToBytes32(checkpoint.root).toLowerCase()) {
        throw new HttpException(
          `🛑 Thao tác bị từ chối! Dữ liệu thuộc Lô #${batchId} đã bị CAN THIỆP/SỬA ĐỔI trái phép trong Database local. Hệ thống đã tự động KHÓA thao tác Chỉnh sửa/Xóa. Vui lòng khôi phục từ Blockchain trước!`,
          423,
        );
      }
    }

    return true;
  }
}

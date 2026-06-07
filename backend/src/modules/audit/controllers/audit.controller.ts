import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { FaceStepUpGuard } from '../../../common/stepup/face-stepup.guard';
import { RequireFaceStepUp } from '../../../common/stepup/require-face-stepup.decorator';
import { AuditLoggerService } from '../../../infrastructure/audit/audit-logger.service';
import { AuditAnchorService } from '../../../infrastructure/audit/audit-anchor.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

/**
 * Admin-only audit + integrity API. Surfaces the tamper-evidence machinery so it can be
 * demonstrated and operated:
 *  - history:    paginated audit log (the hash-chained BlockchainLogger).
 *  - verifyChain: walk the off-chain hash-chain, flagging any altered/removed/reordered row.
 *  - batches:    list committed Merkle checkpoints (on-chain anchors).
 *  - proof:      Merkle inclusion proof for a single log, independently verifiable.
 *  - anchorNow:  force-seal+commit the current batch (Tier-A / on-demand).
 */
@UseGuards(JwtAuthGuard, RolesGuard, FaceStepUpGuard)
@Roles('ADMIN')
@ApiTags('Audit & Integrity')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(
    private readonly audit: AuditLoggerService,
    private readonly anchor: AuditAnchorService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('logs')
  @ApiOperation({ summary: 'List audit log entries (hash-chained) with pagination, sort & batch filter' })
  async logs(
    @Query('entity') entity?: string,
    @Query('batch') batchRaw?: string,
    @Query('sort') sortRaw?: string,
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const page = Math.max(Number(pageRaw) || 1, 1);
    const limit = Math.max(Number(limitRaw) || 10, 1);
    const skip = (page - 1) * limit;
    // Display order only — the tamper-evident chain itself is always keyed by the monotonic seq.
    const sort: 'asc' | 'desc' = sortRaw === 'asc' ? 'asc' : 'desc';

    const where: { entity?: string; batchId?: number } = {};
    if (entity) where.entity = entity;
    if (batchRaw !== undefined && batchRaw !== '' && Number.isFinite(Number(batchRaw))) {
      where.batchId = Number(batchRaw);
    }

    const [items, total] = await Promise.all([
      this.prisma.blockchainLogger.findMany({
        where,
        orderBy: { seq: sort },
        skip,
        take: limit,
      }),
      this.prisma.blockchainLogger.count({ where }),
    ]);

    // Enrich each row with the actor's identity (username + role + display name). The logger only
    // stores actorId, so we resolve the distinct ids in ONE batched query (no N+1) and map them
    // back. Admins display their admin username; staff roles display their full name.
    const actorIds = [...new Set(items.map((r) => r.actorId).filter((id): id is string => Boolean(id)))];
    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
            staffProfile: { select: { fullName: true } },
            adminProfile: { select: { adminUserName: true } },
          },
        })
      : [];
    const actorMap = new Map(actors.map((a) => [a.id, a]));

    const itemsWithStatus = items.map((row) => {
      const actor = row.actorId ? actorMap.get(row.actorId) : null;
      return {
        ...row,
        blockchainStatus: this.audit.verifyEntry(row) ? 'VERIFIED' : 'TAMPERED',
        actor: actor
          ? {
              id: actor.id,
              username: actor.username,
              email: actor.email,
              role: actor.role,
              displayName: actor.staffProfile?.fullName || actor.adminProfile?.adminUserName || actor.username,
            }
          : null,
      };
    });

    return {
      items: itemsWithStatus,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  @Get('verify-chain')
  @ApiOperation({ summary: 'Verify the off-chain hash-chain integrity end to end' })
  verifyChain() {
    return this.audit.verifyChain();
  }

  @Get('batches')
  @ApiOperation({ summary: 'List on-chain Merkle anchor checkpoints with pagination' })
  async batches(
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const page = Math.max(Number(pageRaw) || 1, 1);
    const limit = Math.max(Number(limitRaw) || 10, 1);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.auditBatch.findMany({
        orderBy: { batchId: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditBatch.count(),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  @Get('logs/:seq/proof')
  @ApiOperation({ summary: 'Merkle inclusion proof for one log, verified against the on-chain root' })
  proof(@Param('seq') seq: string) {
    return this.anchor.getInclusionProof(Number(seq));
  }

  @Post('anchor-now')
  @RequireFaceStepUp('ANCHOR_BLOCKCHAIN')
  @ApiOperation({ summary: 'Force-seal the pending batch and commit its Merkle root on-chain (requires face step-up)' })
  anchorNow() {
    return this.anchor.anchorNow();
  }
}

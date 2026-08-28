import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AuditLoggerService, AuditAnchorService, AuditRecoveryService, EntityRecoveryService } from '../../../infrastructure/audit';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../common/types/auth-user.type';
import { FaceStepUpGuard } from '../../../common/stepup/face-stepup.guard';
import { RequireFaceStepUp } from '../../../common/stepup/require-face-stepup.decorator';
import { RecoverAuditBatchDto } from '../dto/recover-audit-batch.dto';
import { PreviewRecoverAuditEntitiesDto, RecoverAuditEntitiesDto } from '../dto/recover-audit-entities.dto';
import { ListAuditLogsQuery } from '../application/queries/list-audit-logs.query';
import { ListAuditBatchesQuery } from '../application/queries/list-audit-batches.query';

/**
 * Admin-only audit + integrity API. Surfaces the tamper-evidence machinery so it can be
 * demonstrated and operated.
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
    private readonly recovery: AuditRecoveryService,
    private readonly entityRecovery: EntityRecoveryService,
    private readonly logsQuery: ListAuditLogsQuery,
    private readonly batchesQuery: ListAuditBatchesQuery,
  ) {}

  @Get('recovery/deep-scan/status')
  @ApiOperation({ summary: 'Get real-time status & logs of background audit deep-scan and self-healing' })
  getDeepScanStatus() {
    return this.recovery.getDeepScanStatus();
  }

  @Get('recovery/watchdog/status')
  @ApiOperation({ summary: 'Get background 20-minute watchdog auto-heal status and schedule' })
  getWatchdogStatus() {
    return this.recovery.getWatchdogStatus();
  }

  @Post('recovery/deep-scan')
  @RequireFaceStepUp('DEEP_SCAN_SELF_HEAL')
  @ApiOperation({ summary: 'Trigger Face-authenticated deep-scan verification and automated batch self-healing' })
  startDeepScan(@CurrentUser() user: AuthUser) {
    return this.recovery.startDeepScanAndSelfHeal(user.sub);
  }

  @Get('recovery/entities/warnings')
  @ApiOperation({ summary: 'List business entities whose live data differs from the latest anchored audit snapshot' })
  entityWarnings(@Query('limit') limitRaw?: string) {
    const limit = Math.min(Math.max(Number(limitRaw) || 100, 1), 200);
    return this.entityRecovery.listWarnings(limit);
  }

  @Post('recovery/entities')
  @RequireFaceStepUp('RECOVER_AUDIT_ENTITIES')
  @ApiOperation({ summary: 'Recover selected business entities from verified encrypted audit snapshots' })
  recoverEntities(@Body() body: RecoverAuditEntitiesDto, @CurrentUser() user: AuthUser) {
    return this.entityRecovery.recoverMany(body.items, user.sub, body.reason.trim());
  }

  @Post('recovery/entities/preview')
  @ApiOperation({ summary: 'Preview entity recovery without returning decrypted audit snapshots' })
  previewRecoverEntities(@Body() body: PreviewRecoverAuditEntitiesDto) {
    return this.entityRecovery.previewMany(body.items);
  }

  @Get('logs')
  @ApiOperation({ summary: 'List audit log entries (hash-chained) with pagination, sort & batch filter' })
  async logs(
    @Query('entity') entity?: string,
    @Query('entityId') entityId?: string,
    @Query('q') q?: string,
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('verificationStatus') verificationStatus?: string,
    @Query('batch') batch?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.logsQuery.execute(
      { entity, entityId, q, action, actorId, from, to, verificationStatus, batch, sort, page, limit },
      user,
    );
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
    @Query('sortBy') sortByRaw?: string,
    @Query('sort') sortRaw?: string,
  ) {
    return this.batchesQuery.execute(pageRaw, limitRaw, sortByRaw, sortRaw);
  }

  @Get('batches/:batchId')
  @ApiOperation({ summary: 'Batch detail with all audit seq leaves and integrity summary' })
  async batchDetail(
    @Param('batchId', ParseIntPipe) batchId: number,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.batchesQuery.getBatchDetail(batchId, user);
  }

  @Get('logs/:seq')
  @ApiOperation({ summary: 'Get one audit log with readable diff and V2 verification details' })
  async logDetail(@Param('seq') seq: string, @CurrentUser() user?: AuthUser) {
    return this.logsQuery.getLogDetail(Number(seq), user);
  }

  @Get('logs/:seq/proof')
  @ApiOperation({ summary: 'Merkle inclusion proof for one log, verified against the on-chain root' })
  proof(@Param('seq') seq: string) {
    return this.anchor.getInclusionProof(Number(seq));
  }

  @Post('anchor-now')
  @ApiOperation({ summary: 'Force-seal the pending batch and commit its Merkle root on-chain' })
  anchorNow() {
    return this.anchor.anchorNow();
  }

  @Post('recovery/:batchId')
  @RequireFaceStepUp('RECOVER_AUDIT_BATCH')
  @ApiOperation({ summary: 'Recover one tampered audit batch from its verified IPFS artifact' })
  recoverBatch(
    @Param('batchId', ParseIntPipe) batchId: number,
    @Body() body: RecoverAuditBatchDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.recovery.recover(batchId, user.sub, body.reason);
  }
}
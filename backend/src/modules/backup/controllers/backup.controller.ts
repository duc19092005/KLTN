import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../common/types/auth-user.type';
import { FaceStepUpGuard } from '../../../common/stepup/face-stepup.guard';
import { RequireFaceStepUp } from '../../../common/stepup/require-face-stepup.decorator';
import { CreateBackupUseCase } from '../application/use-cases/create-backup.use-case';
import { ListBackupsUseCase } from '../application/use-cases/list-backups.use-case';
import { ScanIntegrityUseCase } from '../application/use-cases/scan-integrity.use-case';
import { SurgicalRestoreUseCase } from '../application/use-cases/surgical-restore.use-case';
import { SurgicalRestoreDto } from '../dto/backup.dto';

/**
 * Admin-only backup & recovery API.
 *  - create:   produce a dump, hash it, anchor the manifest on-chain (self-verifying backup).
 *  - list:     queryable backup history (DB mirror of the offsite JSONL ledger).
 *  - scan:     detect records whose live DB value drifted from their on-chain-anchored snapshot.
 *  - restore:  surgically revert ONLY the tampered records to their trusted anchored snapshot.
 *
 * Data-mutating endpoints (create, restore) require a fresh face step-up, mirroring anchor-now.
 */
@UseGuards(JwtAuthGuard, RolesGuard, FaceStepUpGuard)
@Roles('ADMIN')
@ApiTags('Backup & Recovery')
@ApiBearerAuth()
@Controller('backup')
export class BackupController {
  constructor(
    private readonly createBackup: CreateBackupUseCase,
    private readonly listBackups: ListBackupsUseCase,
    private readonly scanIntegrity: ScanIntegrityUseCase,
    private readonly surgicalRestore: SurgicalRestoreUseCase,
  ) {}

  @Post()
  @RequireFaceStepUp('CREATE_BACKUP')
  @ApiOperation({ summary: 'Create a self-verifying backup (dump + on-chain anchored manifest)' })
  create(@CurrentUser() user: AuthUser) {
    return this.createBackup.execute(user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'List backup records (newest first) with pagination' })
  list(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.listBackups.execute(Number(page) || 1, Number(limit) || 10);
  }

  @Get('scan')
  @ApiOperation({ summary: 'Scan for records drifted from their on-chain-anchored snapshot' })
  scan() {
    return this.scanIntegrity.execute();
  }

  @Post('restore')
  @RequireFaceStepUp('SURGICAL_RESTORE')
  @ApiOperation({ summary: 'Surgically restore tampered records from their anchored snapshot' })
  restore(@Body() dto: SurgicalRestoreDto, @CurrentUser() user: AuthUser) {
    return this.surgicalRestore.execute(dto.items, user.sub);
  }
}

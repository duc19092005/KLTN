import {
  Controller,
  Post,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { BackupService } from './backup.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('backup')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  /**
   * POST /api/backup/trigger
   * Manually trigger a full database backup and mint NFT
   * Admin only
   */
  @Post('trigger')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  async triggerBackup() {
    try {
      const result = await this.backupService.runFullBackup();
      return {
        message: 'Full backup completed and registered on-chain successfully',
        ...result,
      };
    } catch (err: any) {
      throw new BadRequestException(`Backup trigger failed: ${err.message}`);
    }
  }

  /**
   * GET /api/backup/hourly-list
   * Get list of hourly backup CIDs for a given date
   * Query param: date (YYYY-MM-DD)
   * Admin only
   */
  @Get('hourly-list')
  @Roles('ADMIN')
  async getHourlyList(@Query('date') date: string) {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('Invalid date format. Expected YYYY-MM-DD');
    }
    const cids = await this.backupService.getHourlyCids(date);
    return {
      date,
      count: cids.length,
      cids,
    };
  }

  /**
   * GET /api/backup/download
   * Download and decrypt a backup SQL/WAL file by its CID
   * Query param: cid
   * Admin only
   */
  @Get('download')
  @Roles('ADMIN')
  async downloadBackup(@Query('cid') cid: string, @Res() res: Response) {
    if (!cid) {
      throw new BadRequestException('Backup CID is required');
    }

    try {
      const decryptedContent = this.backupService.getDecryptedBackup(cid);
      const isWal = cid.includes('wal-');
      const filename = isWal ? `wal-${cid.substring(7)}.sql` : `backup-full-${cid.substring(12)}.sql`;

      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(HttpStatus.OK).send(decryptedContent);
    } catch (err: any) {
      throw new BadRequestException(`Failed to download backup: ${err.message}`);
    }
  }

  /**
   * GET /api/backup/list
   * List all available backups (Full and WAL) on storage
   * Admin only
   */
  @Get('list')
  @Roles('ADMIN')
  async listBackups() {
    return this.backupService.listAvailableBackups();
  }

  /**
   * POST /api/backup/restore
   * Restore database from a specific backup CID
   * Admin only
   */
  @Post('restore')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  async restoreBackup(@Query('cid') cid: string) {
    if (!cid) {
      throw new BadRequestException('Backup CID is required for restoration');
    }
    try {
      await this.backupService.restoreBackup(cid);
      return {
        success: true,
        message: `Database successfully restored to checkpoint ${cid}`,
      };
    } catch (err: any) {
      throw new BadRequestException(`Restore operation failed: ${err.message}`);
    }
  }
}

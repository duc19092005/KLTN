import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AuditModule } from '../../infrastructure/audit/audit.module';
import { BackupController } from './controllers/backup.controller';
import { CreateBackupUseCase } from './application/use-cases/create-backup.use-case';
import { ListBackupsUseCase } from './application/use-cases/list-backups.use-case';
import { ScanIntegrityUseCase } from './application/use-cases/scan-integrity.use-case';
import { SurgicalRestoreUseCase } from './application/use-cases/surgical-restore.use-case';
import { BackupSchedulerService } from './application/services/backup-scheduler.service';
import { BACKUP_STORAGE } from './application/ports/backup-storage.port';
import { BACKUP_LEDGER } from './application/ports/backup-ledger.port';
import { PgDumpBackupStorage } from './infrastructure/adapters/pg-dump-backup.storage';
import { JsonlBackupLedger } from './infrastructure/adapters/jsonl-backup-ledger';

/**
 * Backup & recovery feature module. AuditLoggerService / AuditAnchorService come from the @Global
 * AuditModule and PrismaService from the @Global PrismaModule; this module wires the backup
 * use-cases and binds the storage/ledger ports to their concrete adapters.
 */
@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [BackupController],
  providers: [
    CreateBackupUseCase,
    ListBackupsUseCase,
    ScanIntegrityUseCase,
    SurgicalRestoreUseCase,
    BackupSchedulerService,
    { provide: BACKUP_STORAGE, useClass: PgDumpBackupStorage },
    { provide: BACKUP_LEDGER, useClass: JsonlBackupLedger },
  ],
})
export class BackupModule {}

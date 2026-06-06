import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { AuditLoggerService } from '../../../../infrastructure/audit/audit-logger.service';
import { AuditAnchorService } from '../../../../infrastructure/audit/audit-anchor.service';
import { BACKUP_STORAGE, BackupStoragePort } from '../ports/backup-storage.port';
import { BACKUP_LEDGER, BackupLedgerPort } from '../ports/backup-ledger.port';
import { computeBackupEntryHash, sha256Buffer, BackupManifest } from '../../domain/backup-manifest';

/**
 * Create a self-verifying backup:
 *  1. Snapshot the current chain head (maxSeq) so we know how fresh the dump is.
 *  2. Produce the dump and hash its bytes (sha256) — proves the file is not altered later.
 *  3. Hash-chain a manifest into the offsite JSONL ledger (survives DB loss).
 *  4. Record a SystemBackup entry in BlockchainLogger and anchorNow() — seals (sha256, maxSeq,
 *     createdAt) on-chain immediately (backup is a Tier-A event).
 *  5. Mirror the manifest into BackupRecord for day-to-day admin querying.
 *
 * If the on-chain anchor fails, the backup is still created and ledgered; status reflects the gap
 * and the next anchor cycle will seal the manifest entry.
 */
@Injectable()
export class CreateBackupUseCase {
  private readonly logger = new Logger(CreateBackupUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLoggerService,
    private readonly auditAnchor: AuditAnchorService,
    @Inject(BACKUP_STORAGE) private readonly storage: BackupStoragePort,
    @Inject(BACKUP_LEDGER) private readonly ledger: BackupLedgerPort,
  ) {}

  async execute(actorId?: string): Promise<{ backupCode: string; sha256: string; maxSeq: number | null; status: string; anchored: boolean }> {
    const backupCode = await this.generateBackupCode();
    const createdAtIso = new Date().toISOString();

    // 1. Current audited-change frontier the dump will contain.
    const tail = await this.prisma.blockchainLogger.findFirst({
      where: { seq: { not: null } },
      orderBy: { seq: 'desc' },
      select: { seq: true },
    });
    const maxSeq = tail?.seq ?? null;

    // 2. Produce the dump + hash its bytes.
    const artifact = await this.storage.createDump(backupCode);
    const sha256 = sha256Buffer(artifact.buffer);

    const manifest: BackupManifest = {
      backupCode,
      fileName: artifact.fileName,
      sha256,
      sizeBytes: artifact.sizeBytes,
      maxSeq,
      createdAtIso,
    };

    // 3. Hash-chain into the offsite ledger.
    const prevHash = await this.ledger.getTailHash();
    const entryHash = computeBackupEntryHash(manifest, prevHash);

    // 4. Anchor the manifest on-chain via the shared audit trail (Tier-A: anchor immediately).
    let anchorSeq: number | null = null;
    let anchorTxHash: string | null = null;
    let anchored = false;
    try {
      const logRow = await this.audit.record({
        entity: 'SystemBackup',
        entityId: backupCode,
        action: 'CREATE',
        actorId: actorId ?? null,
        dataHash: sha256,
        metadata: { fileName: artifact.fileName, sizeBytes: artifact.sizeBytes, maxSeq, entryHash } as any,
        onChainStatus: 'PENDING',
      });
      anchorSeq = (logRow as any).seq ?? null;

      const res = await this.auditAnchor.anchorNow();
      anchored = res.committed;
      if (anchored && anchorSeq != null) {
        const anchoredRow = await this.prisma.blockchainLogger.findFirst({
          where: { seq: anchorSeq },
          select: { txHash: true },
        });
        anchorTxHash = anchoredRow?.txHash ?? null;
      }
    } catch (err) {
      this.logger.error('Anchoring backup manifest failed; will be sealed by next batch cycle.', err as any);
    }

    await this.ledger.append({ ...manifest, prevHash, entryHash, anchorSeq, anchorTxHash });

    // 5. Mirror into the queryable DB table.
    const status = anchored ? 'ANCHORED' : 'CREATED';
    await this.prisma.backupRecord.create({
      data: {
        backupCode,
        fileName: artifact.fileName,
        storagePath: artifact.storagePath,
        sha256,
        sizeBytes: artifact.sizeBytes,
        maxSeq,
        prevHash,
        entryHash,
        anchorSeq,
        anchorTxHash,
        status,
        createdBy: actorId ?? null,
      },
    });

    this.logger.log(`Backup ${backupCode} created (maxSeq=${maxSeq}, anchored=${anchored}).`);
    return { backupCode, sha256, maxSeq, status, anchored };
  }

  /** Generate a human-readable, per-day monotonic backup code: BK-YYYYMMDD-NNNN. */
  private async generateBackupCode(): Promise<string> {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const prefix = `BK-${y}${m}${d}`;
    const todayCount = await this.prisma.backupRecord.count({
      where: { backupCode: { startsWith: prefix } },
    });
    return `${prefix}-${String(todayCount + 1).padStart(4, '0')}`;
  }
}

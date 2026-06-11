import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { GENESIS_PREV_HASH } from '../../../../infrastructure/audit/audit-hash.util';
import { BackupLedgerEntry, BackupLedgerPort } from '../../application/ports/backup-ledger.port';

/**
 * Append-only JSONL ledger for backups, written to BACKUP_LEDGER_PATH (default
 * ./storage/backups/backup-ledger.jsonl). Each line is one hash-chained BackupLedgerEntry.
 *
 * This file is the authoritative record an operator reads during a disaster (DB down/encrypted):
 * it is plain text, requires no backend or DB to inspect, and the hash-chain makes tampering with
 * past lines provable. Keep BACKUP_LEDGER_PATH on the same offsite/separate volume as the dumps.
 */
@Injectable()
export class JsonlBackupLedger implements BackupLedgerPort {
  private readonly logger = new Logger(JsonlBackupLedger.name);
  private readonly ledgerPath =
    process.env.BACKUP_LEDGER_PATH ||
    path.resolve(process.cwd(), 'storage', 'backups', 'backup-ledger.jsonl');

  // Serialize appends so the chain tail is read + written atomically (single-instance scope).
  private writeChain: Promise<unknown> = Promise.resolve();

  async getTailHash(): Promise<string> {
    const entries = await this.readAll();
    if (entries.length === 0) return GENESIS_PREV_HASH;
    return entries[entries.length - 1].entryHash;
  }

  async append(entry: BackupLedgerEntry): Promise<void> {
    const next = this.writeChain.then(async () => {
      await fs.mkdir(path.dirname(this.ledgerPath), { recursive: true });
      await fs.appendFile(this.ledgerPath, JSON.stringify(entry) + '\n', 'utf8');
      this.logger.log(`Backup ledger appended: ${entry.backupCode}`);
    });
    this.writeChain = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  async readAll(): Promise<BackupLedgerEntry[]> {
    try {
      const raw = await fs.readFile(this.ledgerPath, 'utf8');
      return raw
        .split('\n')
        .filter((l) => l.trim().length > 0)
        .map((l) => JSON.parse(l) as BackupLedgerEntry);
    } catch (err: any) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
  }
}

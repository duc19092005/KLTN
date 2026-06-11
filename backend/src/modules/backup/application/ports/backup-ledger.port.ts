import { BackupManifest } from '../../domain/backup-manifest';

/**
 * Port for the authoritative, append-only backup ledger written OUTSIDE the database (JSONL on a
 * separate volume / object store). This is the source of truth that lets an operator audit backups
 * even when the DB is destroyed or encrypted. Each appended line is hash-chained.
 */
export const BACKUP_LEDGER = Symbol('BACKUP_LEDGER');

export interface BackupLedgerEntry extends BackupManifest {
  prevHash: string;
  entryHash: string;
  anchorSeq: number | null;
  anchorTxHash: string | null;
}

export interface BackupLedgerPort {
  /** entryHash of the last ledger line, or the genesis value if the ledger is empty. */
  getTailHash(): Promise<string>;

  /** Append one hash-chained line to the offsite ledger. */
  append(entry: BackupLedgerEntry): Promise<void>;

  /** Read all ledger lines in order (for verification / break-glass export). */
  readAll(): Promise<BackupLedgerEntry[]>;
}

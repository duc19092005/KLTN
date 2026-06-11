/**
 * Port for producing and managing the raw backup artifact (a PostgreSQL dump).
 * Implementations shell out to pg_dump (or an equivalent) and persist the file somewhere that
 * survives a DB loss (separate volume / object store).
 */
export const BACKUP_STORAGE = Symbol('BACKUP_STORAGE');

export interface BackupArtifact {
  fileName: string;
  storagePath: string;
  buffer: Buffer;
  sizeBytes: number;
}

export interface BackupStoragePort {
  /** Create a fresh dump of the database. Returns the file bytes + where it was stored. */
  createDump(backupCode: string): Promise<BackupArtifact>;

  /** Read back a previously stored dump (for integrity re-verification). Null if missing. */
  readDump(storagePath: string): Promise<Buffer | null>;
}

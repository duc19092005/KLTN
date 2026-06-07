import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import { BackupArtifact, BackupStoragePort } from '../../application/ports/backup-storage.port';

/**
 * pg_dump-based backup storage. Shells out to `pg_dump` (custom format) using the DATABASE_URL,
 * writing the dump to BACKUP_DIR (default ./storage/backups). BACKUP_DIR SHOULD point at a volume
 * separate from the database's own storage so a DB-host failure does not take the backups with it.
 *
 * Security: the connection string is passed via the PGURI-style single argument to pg_dump rather
 * than interpolated into a shell string, and we use spawn (no shell) to avoid command injection.
 */
@Injectable()
export class PgDumpBackupStorage implements BackupStoragePort {
  private readonly logger = new Logger(PgDumpBackupStorage.name);
  private readonly backupDir = process.env.BACKUP_DIR || path.resolve(process.cwd(), 'storage', 'backups');
  private readonly pgDumpBin = process.env.PG_DUMP_BIN || 'pg_dump';

  async createDump(backupCode: string): Promise<BackupArtifact> {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error('DATABASE_URL chưa được cấu hình; không thể tạo backup.');

    await fs.mkdir(this.backupDir, { recursive: true });
    const fileName = `${backupCode}.dump`;
    const storagePath = path.join(this.backupDir, fileName);

    await this.runPgDump(this.toLibpqUri(databaseUrl), storagePath);

    const buffer = await fs.readFile(storagePath);
    return { fileName, storagePath, buffer, sizeBytes: buffer.length };
  }

  /**
   * Prisma's DATABASE_URL carries ORM-only query params (notably `?schema=public`, also
   * `connection_limit`, `pgbouncer`, etc.) that pg_dump's libpq URI parser rejects with
   * "invalid URI query parameter". Keep only params libpq understands and drop the rest.
   *
   * We intentionally drop `schema`: pg_dump dumps ALL schemas by default (exactly what a full
   * backup wants), and `public` is the default search_path regardless. We avoid forwarding it via
   * `options=-c search_path=...` because URLSearchParams encodes the required space as '+', which
   * libpq misparses as a bogus config parameter ("+search_path").
   */
  private toLibpqUri(databaseUrl: string): string {
    try {
      const url = new URL(databaseUrl);
      const LIBPQ_ALLOWED = new Set([
        'host', 'port', 'dbname', 'user', 'password', 'sslmode', 'connect_timeout',
        'application_name', 'target_session_attrs',
      ]);
      const kept = new URLSearchParams();
      for (const [key, value] of url.searchParams.entries()) {
        if (LIBPQ_ALLOWED.has(key)) kept.set(key, value);
      }
      url.search = kept.toString();
      return url.toString();
    } catch {
      // If it isn't a parseable URI (e.g. key=value DSN), pass it through unchanged.
      return databaseUrl;
    }
  }

  async readDump(storagePath: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(storagePath);
    } catch {
      return null;
    }
  }

  /** Run pg_dump in custom format to `outPath`. Rejects on non-zero exit. No shell is used. */
  private runPgDump(databaseUrl: string, outPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // -Fc: custom compressed format; -f: output file; --dbname accepts a full connection URI.
      const args = ['-Fc', '-f', outPath, '--dbname', databaseUrl];
      const child = spawn(this.pgDumpBin, args, { stdio: ['ignore', 'ignore', 'pipe'] });

      let stderr = '';
      child.stderr.on('data', (d) => (stderr += d.toString()));
      child.on('error', (err) => {
        reject(new Error(`Không thể chạy ${this.pgDumpBin}: ${err.message}. Hãy đảm bảo pg_dump đã được cài.`));
      });
      child.on('close', (code) => {
        if (code === 0) {
          this.logger.log(`pg_dump hoàn tất: ${outPath}`);
          resolve();
        } else {
          reject(new Error(`pg_dump thất bại (mã ${code}): ${stderr.trim()}`));
        }
      });
    });
  }
}

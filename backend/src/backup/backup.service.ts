import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { BlockchainService } from '../blockchain/blockchain.service';
import { EncryptionService } from '../encryption/encryption.service';

@Injectable()
export class BackupService implements OnModuleInit {
  private readonly logger = new Logger(BackupService.name);
  private readonly mockIpfsDir = path.join(__dirname, '..', '..', 'mock-ipfs');
  private readonly walSourceDir = '/wal_archive';

  constructor(
    private readonly blockchainService: BlockchainService,
    private readonly encryptionService: EncryptionService,
  ) {}

  onModuleInit() {
    // Ensure mock-ipfs directory exists
    if (!fs.existsSync(this.mockIpfsDir)) {
      fs.mkdirSync(this.mockIpfsDir, { recursive: true });
      this.logger.log(`Created Mock IPFS directory at: ${this.mockIpfsDir}`);
    }
  }

  /**
   * Daily Full Backup at 2:00 AM
   * CronExpression.EVERY_DAY_AT_2AM is "0 2 * * *"
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleDailyBackup() {
    this.logger.log('🚀 Triggering scheduled Daily Full Database Backup at 2:00 AM...');
    try {
      await this.runFullBackup();
    } catch (err: any) {
      this.logger.error(`❌ Scheduled daily backup failed: ${err.message}`, err.stack);
    }
  }

  /**
   * Scan for new WAL archive segments every 1 minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async scanWalSegments() {
    if (!fs.existsSync(this.walSourceDir)) {
      // If shared volume is not mounted or doesn't exist yet, skip silently
      return;
    }

    try {
      const files = fs.readdirSync(this.walSourceDir);
      const walFiles = files.filter(f => /^[0-9A-F]{24}$/.test(f) || f.endsWith('.history'));

      if (walFiles.length === 0) return;

      this.logger.log(`🔍 Found ${walFiles.length} new WAL segment(s) to archive...`);
      const dateKey = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"

      for (const file of walFiles) {
        const filePath = path.join(this.walSourceDir, file);
        const fileContent = fs.readFileSync(filePath);

        // 1. Encrypt WAL file content using EncryptionService (AES-256-CBC)
        const encryptedHex = this.encryptionService.encrypt(fileContent.toString('base64'));

        // 2. Save encrypted content to mock IPFS
        const mockCid = `ipfs://wal-${file}-${crypto.createHash('md5').update(file).digest('hex').substring(0, 8)}`;
        const destPath = path.join(this.mockIpfsDir, `${mockCid.replace('://', '_')}.enc`);
        fs.writeFileSync(destPath, encryptedHex);

        // 3. Register WAL CID on-chain
        const txResult = await this.blockchainService.addHourlyBackup(dateKey, mockCid);
        if (txResult.success) {
          this.logger.log(`✅ WAL segment ${file} archived to ${mockCid} and registered on-chain. Tx: ${txResult.txHash}`);
          // 4. Delete spooled WAL file to save disk space
          fs.unlinkSync(filePath);
        } else {
          this.logger.error(`❌ Failed to register WAL ${file} on blockchain: ${txResult.error}`);
        }
      }
    } catch (err: any) {
      this.logger.error(`❌ WAL scanning error: ${err.message}`, err.stack);
    }
  }

  /**
   * Run a Full Backup, encrypt it, upload to mock-ipfs, and mint an NFT
   */
  async runFullBackup() {
    const timestamp = Date.now();
    const dateStr = new Date().toISOString().split('T')[0];
    const tempSqlPath = path.join('/tmp', `backup-${timestamp}.sql`);
    
    // Parse DATABASE_URL
    const dbUrlStr = process.env.DATABASE_URL;
    if (!dbUrlStr) {
      throw new Error('DATABASE_URL env variable not configured');
    }

    const dbUrl = new URL(dbUrlStr);
    const host = dbUrl.hostname;
    const port = dbUrl.port || '5432';
    const username = dbUrl.username;
    const password = dbUrl.password;
    const database = dbUrl.pathname.replace(/^\//, '');

    this.logger.log(`Dumping database "${database}" from host "${host}:${port}"...`);

    // Run pg_dump
    const dumpCmd = `PGPASSWORD="${password}" pg_dump -h "${host}" -p "${port}" -U "${username}" -d "${database}" -F p -f "${tempSqlPath}"`;
    execSync(dumpCmd);

    if (!fs.existsSync(tempSqlPath)) {
      throw new Error('pg_dump failed to generate SQL file');
    }

    try {
      const sqlContent = fs.readFileSync(tempSqlPath, 'utf8');

      // Encrypt SQL backup using AES-256
      const encryptedHex = this.encryptionService.encrypt(sqlContent);
      const fileHash = this.encryptionService.hash(encryptedHex); // SHA-256 of encrypted file

      // Upload to mock IPFS
      const mockCid = `ipfs://backup-full-${dateStr}-${timestamp}`;
      const destPath = path.join(this.mockIpfsDir, `${mockCid.replace('://', '_')}.enc`);
      fs.writeFileSync(destPath, encryptedHex);

      this.logger.log(`Database backup saved to mock IPFS: ${mockCid}`);

      // Delete temp raw SQL file immediately
      fs.unlinkSync(tempSqlPath);

      // Mint Backup NFT (recipient is Super Admin)
      const recipient = this.blockchainService.getSuperAdminAddress();
      if (!recipient) {
        throw new Error('Super Admin relayer address could not be resolved');
      }

      // Metadata URI for the NFT
      const tokenUri = `data:application/json;base64,${Buffer.from(
        JSON.stringify({
          name: `DB Backup Checkpoint ${dateStr}`,
          description: `Immutable encrypted backup of the Hospital Database for ${dateStr}`,
          image: 'https://img.icons8.com/color/512/database-restore.png',
          attributes: [
            { trait_type: 'Backup Date', value: dateStr },
            { trait_type: 'IPFS CID', value: mockCid },
            { trait_type: 'SHA256 Hash', value: fileHash },
            { trait_type: 'Type', value: 'Full Daily' }
          ]
        })
      ).toString('base64')}`;

      this.logger.log(`Minting Daily Backup NFT to ${recipient}...`);
      const txResult = await this.blockchainService.mintBackupNFT(recipient, tokenUri, mockCid, `0x${fileHash}`);

      if (!txResult.success) {
        throw new Error(`On-chain NFT minting failed: ${txResult.error}`);
      }

      this.logger.log(`🏆 Daily backup complete! NFT Minted successfully. Tx: ${txResult.txHash}`);
      return {
        success: true,
        cid: mockCid,
        fileHash,
        txHash: txResult.txHash,
      };
    } catch (err) {
      if (fs.existsSync(tempSqlPath)) {
        fs.unlinkSync(tempSqlPath);
      }
      throw err;
    }
  }

  /**
   * Get active backup list from blockchain events / registry
   */
  async getHourlyCids(dateKey: string): Promise<string[]> {
    return this.blockchainService.getHourlyBackups(dateKey);
  }

  /**
   * Download a backup file from Mock IPFS
   */
  getDecryptedBackup(cid: string): string {
    const fileName = `${cid.replace('://', '_')}.enc`;
    const filePath = path.join(this.mockIpfsDir, fileName);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Backup file with CID ${cid} not found on storage`);
    }

    const encryptedData = fs.readFileSync(filePath, 'utf8');
    const decryptedData = this.encryptionService.decrypt(encryptedData);

    if (cid.includes('wal-')) {
      // WAL files were base64 encoded prior to encryption
      return Buffer.from(decryptedData, 'base64').toString('utf8');
    }
    return decryptedData;
  }

  /**
   * List all available backups from physical storage
   */
  async listAvailableBackups() {
    if (!fs.existsSync(this.mockIpfsDir)) return { full: [], wal: [] };
    const files = fs.readdirSync(this.mockIpfsDir);
    
    const full = [];
    const wal = [];

    for (const file of files) {
      if (!file.endsWith('.enc')) continue;
      const filePath = path.join(this.mockIpfsDir, file);
      const stat = fs.statSync(filePath);
      
      const cleanName = file.replace('ipfs_', '').replace('.enc', '');
      const cid = cleanName.replace('_', '://'); // e.g. ipfs://backup-full-...
      
      const isWal = file.includes('wal-');
      let timestamp = stat.mtimeMs;
      let date = stat.mtime.toISOString().split('T')[0];

      if (isWal) {
        wal.push({
          cid,
          filename: file,
          size: stat.size,
          timestamp,
          date,
          type: 'WAL'
        });
      } else {
        // Extract timestamp if possible from backup-full-YYYY-MM-DD-timestamp
        const parts = cleanName.split('-');
        if (parts.length >= 6) {
          const tsStr = parts[5];
          if (!isNaN(Number(tsStr))) {
            timestamp = Number(tsStr);
            date = `${parts[2]}-${parts[3]}-${parts[4]}`;
          }
        }
        full.push({
          cid,
          filename: file,
          size: stat.size,
          timestamp,
          date,
          type: 'Full'
        });
      }
    }

    // Sort descending by timestamp
    full.sort((a, b) => b.timestamp - a.timestamp);
    wal.sort((a, b) => b.timestamp - a.timestamp);

    return { full, wal };
  }

  /**
   * Restore database from backup file
   */
  async restoreBackup(cid: string) {
    const sqlContent = this.getDecryptedBackup(cid);
    const tempSqlPath = path.join('/tmp', `restore-${Date.now()}.sql`);
    fs.writeFileSync(tempSqlPath, sqlContent);

    const dbUrlStr = process.env.DATABASE_URL;
    if (!dbUrlStr) {
      throw new Error('DATABASE_URL env variable not configured');
    }

    const dbUrl = new URL(dbUrlStr);
    const host = dbUrl.hostname;
    const port = dbUrl.port || '5432';
    const username = dbUrl.username;
    const password = dbUrl.password;
    const database = dbUrl.pathname.replace(/^\//, '');

    this.logger.log(`Restoring database "${database}" from backup "${cid}"...`);

    try {
      // Drop public schema CASCADE to delete all tables, types, triggers, etc.
      const dropCmd = `PGPASSWORD="${password}" psql -h "${host}" -p "${port}" -U "${username}" -d "${database}" -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;"`;
      execSync(dropCmd);

      // Restore schema and data from backup SQL
      const restoreCmd = `PGPASSWORD="${password}" psql -h "${host}" -p "${port}" -U "${username}" -d "${database}" -f "${tempSqlPath}"`;
      execSync(restoreCmd);

      this.logger.log(`✅ Database successfully restored from backup ${cid}`);
      fs.unlinkSync(tempSqlPath);
      return { success: true };
    } catch (err: any) {
      if (fs.existsSync(tempSqlPath)) {
        fs.unlinkSync(tempSqlPath);
      }
      this.logger.error(`❌ Restore failed: ${err.message}`, err.stack);
      throw new Error(`Database restore failed: ${err.message}`);
    }
  }
}

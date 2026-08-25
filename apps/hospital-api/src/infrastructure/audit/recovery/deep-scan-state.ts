import { AuditRecoveryBundleRow } from '../ipfs/audit-artifact.service';

export interface VerifiedAuditRecoveryBundle {
  batchId: number;
  artifactHash: string;
  artifactUri: string;
  merkleRoot: string;
  logs: AuditRecoveryBundleRow[];
}

export interface DeepScanProgressState {
  active: boolean;
  progressPercent: number;
  statusMessage: string;
  logs: string[];
  startTime: string | null;
  endTime: string | null;
  result: {
    scannedBatches: number;
    recoveredBatches: number;
    recoveredEntities: number;
    errors: string[];
  } | null;
}

export interface WatchdogState {
  enabled: boolean;
  intervalMinutes: number;
  chunkSize: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastScannedBatches: number;
  lastHealedBatches: number;
  lastErrors: string[];
  statusMessage: string;
}

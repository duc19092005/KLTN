import api from '../../../shared/apis/api';

/**
 * Backup & Recovery API (admin only). Backend routes live under /backup:
 *  - create:  produce a dump + anchor its manifest on-chain (requires face step-up CREATE_BACKUP)
 *  - list:    backup history (DB mirror of the offsite JSONL ledger)
 *  - scan:    detect records drifted from their on-chain-anchored snapshot
 *  - restore: surgically revert tampered records (requires face step-up SURGICAL_RESTORE)
 */
export const backupService = {
  list: (params = {}) => api.get('/backup', { params }),
  scan: () => api.get('/backup/scan'),
  create: (stepUpTicket) =>
    api.post('/backup', {}, stepUpTicket ? { headers: { 'x-stepup-ticket': stepUpTicket } } : undefined),
  restore: (items, stepUpTicket) =>
    api.post('/backup/restore', { items }, stepUpTicket ? { headers: { 'x-stepup-ticket': stepUpTicket } } : undefined),
};

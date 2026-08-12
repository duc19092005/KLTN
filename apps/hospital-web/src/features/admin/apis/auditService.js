import api from '../../../shared/apis/api';

/**
 * Audit & Integrity API (admin only). Backend routes live under /audit:
 *  - logs:        hash-chained BlockchainLogger entries (newest first)
 *  - verifyChain: end-to-end off-chain hash-chain integrity check
 *  - batches:     committed Merkle checkpoints (on-chain anchors)
 *  - proof:       Merkle inclusion proof for one log, verified vs the on-chain root
 *  - anchorNow:   force-seal the pending batch and commit its root on-chain
 */
export const auditService = {
  logs: (params = {}) => api.get('/audit/logs', { params }),
  verifyChain: () => api.get('/audit/verify-chain'),
  batches: (params = {}) => api.get('/audit/batches', { params }),
  batchDetail: (batchId) => api.get(`/audit/batches/${batchId}`),
  detail: (seq) => api.get(`/audit/logs/${seq}`),
  proof: (seq) => api.get(`/audit/logs/${seq}/proof`),
  anchorNow: () => api.post('/audit/anchor-now', {}),
  recoverBatch: (batchId, reason, stepUpTicket) => api.post(
    `/audit/recovery/${batchId}`,
    { reason },
    { headers: { 'x-stepup-ticket': stepUpTicket } },
  ),
  entityWarnings: (params = {}) => api.get('/audit/recovery/entities/warnings', { params }),
  recoverEntities: (items, reason) => api.post('/audit/recovery/entities', { items, reason }),
  getDeepScanStatus: () => api.get('/audit/recovery/deep-scan/status'),
  startDeepScan: (stepUpTicket) => api.post(
    '/audit/recovery/deep-scan',
    {},
    { headers: { 'x-stepup-ticket': stepUpTicket } },
  ),
};


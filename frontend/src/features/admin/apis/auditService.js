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
  proof: (seq) => api.get(`/audit/logs/${seq}/proof`),
  anchorNow: (stepUpTicket) =>
    api.post('/audit/anchor-now', {}, stepUpTicket ? { headers: { 'x-stepup-ticket': stepUpTicket } } : undefined),
};

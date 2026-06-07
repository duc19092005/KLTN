import api from '../../../shared/apis/api';

/**
 * Reception shift API client. Mirrors the /api/reception-shifts backend routes.
 * - register/cancel: receptionist's own shifts
 * - approve/reject:  ADMIN or department manager
 * - list/listMine/listPendingForMe: scoped server-side based on the caller's role
 */
export const receptionShiftService = {
  /** Register a new shift on an administrative department (status: PENDING). */
  register: (departmentId, startTime, endTime, note) =>
    api.post('/reception-shifts', { departmentId, startTime, endTime, note }),

  /** List shifts (server scopes to caller for receptionists). Optional filters. */
  list: (params = {}) => api.get('/reception-shifts', { params }),

  /** List PENDING shifts the caller is allowed to approve (admin: all; manager: own dept). */
  listPendingForMe: () => api.get('/reception-shifts/pending-for-me'),

  /** Today's reception KPIs for the caller's department. */
  statsToday: () => api.get('/reception-shifts/stats/today'),

  /** Approve a PENDING shift. */
  approve: (id) => api.patch(`/reception-shifts/${id}/approve`),

  /** Reject a PENDING shift with an optional reason. */
  reject: (id, reason) => api.patch(`/reception-shifts/${id}/reject`, { reason }),

  /** Cancel one of the caller's own PENDING shifts. */
  cancel: (id) => api.delete(`/reception-shifts/${id}`),
};

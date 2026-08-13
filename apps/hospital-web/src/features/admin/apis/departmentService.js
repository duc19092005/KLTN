import api from '../../../shared/apis/api';

export const departmentService = {
  list: (params = {}) => api.get('/departments', { params }),
  create: (payload) => api.post('/departments', payload),
  update: (id, payload) => api.patch(`/departments/${id}`, payload),
  remove: (id) => api.delete(`/departments/${id}`),
  restore: (id) => api.patch(`/departments/${id}/restore`),
  permanentDelete: (id) => api.delete(`/departments/${id}/permanent`),
  softDeleteMany: (ids) => api.post('/departments/bulk/soft-delete', { ids }),
  restoreMany: (ids) => api.post('/departments/bulk/restore', { ids }),
  permanentDeleteMany: (ids) => api.post('/departments/bulk/permanent-delete', { ids }),
  assignManager: (id, managerId) => api.patch(`/departments/${id}/manager`, { managerId }),

  // Blockchain audit: tamper-evidence verification + change history
  verifyAll: () => api.get('/departments/audit/verify'),
  verifyOne: (id) => api.get(`/departments/${id}/audit/verify`),
  history: () => api.get('/departments/audit/history'),
  historyOne: (id) => api.get(`/departments/${id}/audit/history`),
};

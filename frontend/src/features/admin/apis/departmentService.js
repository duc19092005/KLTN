import api from '../../../shared/apis/api';

export const departmentService = {
  list: (params = {}) => api.get('/departments', { params }),
  create: (payload, stepUpTicket) =>
    api.post('/departments', payload, stepUpTicket ? { headers: { 'x-stepup-ticket': stepUpTicket } } : undefined),
  update: (id, payload, stepUpTicket) =>
    api.patch(`/departments/${id}`, payload, stepUpTicket ? { headers: { 'x-stepup-ticket': stepUpTicket } } : undefined),
  remove: (id, stepUpTicket) =>
    api.delete(`/departments/${id}`, stepUpTicket ? { headers: { 'x-stepup-ticket': stepUpTicket } } : undefined),
  assignManager: (id, managerId) => api.patch(`/departments/${id}/manager`, { managerId }),

  // Blockchain audit: tamper-evidence verification + change history
  verifyAll: () => api.get('/departments/audit/verify'),
  verifyOne: (id) => api.get(`/departments/${id}/audit/verify`),
  history: () => api.get('/departments/audit/history'),
  historyOne: (id) => api.get(`/departments/${id}/audit/history`),
};

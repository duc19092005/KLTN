import api from '../../../shared/apis/api';

export const staffService = {
  search: (params = {}) => api.get('/staff', { params }),
  create: (payload) => api.post('/staff', payload),
  update: (id, payload) => api.patch(`/staff/${id}`, payload),
  lock: (id) => api.patch(`/staff/${id}/lock`),
  unlock: (id) => api.patch(`/staff/${id}/unlock`),
  remove: (id, stepUpTicket) =>
    api.delete(`/staff/${id}`, stepUpTicket ? { headers: { 'x-stepup-ticket': stepUpTicket } } : undefined),
};

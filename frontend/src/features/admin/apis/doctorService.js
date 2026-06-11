import api from '../../../shared/apis/api';

export const doctorService = {
  search: (params = {}) => api.get('/doctors', { params }),
  get: (id) => api.get(`/doctors/${id}`),
  create: (payload) => api.post('/doctors', payload),
  createFull: (payload) => api.post('/doctors/full', payload),
  update: (id, payload, stepUpTicket) =>
    api.patch(`/doctors/${id}`, payload, stepUpTicket ? { headers: { 'x-stepup-ticket': stepUpTicket } } : undefined),
  verifyAll: () => api.get('/doctors/audit/verify'),
  verifyOne: (id) => api.get(`/doctors/${id}/audit/verify`),
  history: (id = null) => api.get(id ? `/doctors/${id}/audit/history` : '/doctors/audit/history'),
  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/doctors/upload-avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

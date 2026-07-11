import api from '../../../shared/apis/api';

export const staffService = {
  search: (params = {}) => api.get('/staff', { params }),
  get: (id) => api.get(`/staff/${id}`),
  verifyAll: () => api.get('/staff/audit/verify'),
  verifyOne: (id) => api.get(`/staff/${id}/audit/verify`),
  history: (id = null) => api.get(id ? `/staff/${id}/audit/history` : '/staff/audit/history'),
  create: (payload) => api.post('/staff', payload),
  update: (id, payload) => api.patch(`/staff/${id}`, payload),
  lock: (id) => api.patch(`/staff/${id}/lock`),
  unlock: (id) => api.patch(`/staff/${id}/unlock`),
  remove: (id) => api.delete(`/staff/${id}`),
  restore: (id) => api.patch(`/staff/${id}/restore`),
  permanentDelete: (id) => api.delete(`/staff/${id}/permanent`),
  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/staff/upload-avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

import api from '../../../shared/apis/api';

export const visitService = {
  search: (params = {}) => api.get('/visits', { params }),
  create: (payload) => api.post('/visits', payload),
  suggestDepartments: (specialty) => api.get('/visits/suggest-departments', { params: { specialty } }),
  updateStatus: (id, status) => api.patch(`/visits/${id}/status`, { status }),
};

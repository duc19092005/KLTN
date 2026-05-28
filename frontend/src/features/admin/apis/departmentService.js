import api from '../../../shared/apis/api';

export const departmentService = {
  list: (params = {}) => api.get('/departments', { params }),
  create: (payload) => api.post('/departments', payload),
  update: (id, payload) => api.patch(`/departments/${id}`, payload),
  remove: (id) => api.delete(`/departments/${id}`),
  assignManager: (id, managerId) => api.patch(`/departments/${id}/manager`, { managerId }),
};

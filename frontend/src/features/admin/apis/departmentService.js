import api from '../../../shared/apis/api';

export const departmentService = {
  list: () => api.get('/departments'),
  create: (payload) => api.post('/departments', payload),
  update: (id, payload) => api.patch(`/departments/${id}`, payload),
  remove: (id) => api.delete(`/departments/${id}`),
  assignManager: (id, managerId) => api.patch(`/departments/${id}/manager`, { managerId }),
  listStaffs: (id) => api.get(`/departments/${id}/staffs`),
};

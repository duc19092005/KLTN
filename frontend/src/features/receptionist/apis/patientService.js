import api from '../../../shared/apis/api';

export const patientService = {
  search: (params = {}) => api.get('/patients', { params }),
  get: (id) => api.get(`/patients/${id}`),
  create: (payload) => api.post('/patients', payload),
  update: (id, payload) => api.patch(`/patients/${id}`, payload),
};

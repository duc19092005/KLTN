import api from '../../../shared/apis/api';

export const medicalOrderService = {
  list: (params = {}) => api.get('/medical-orders', { params }),
  create: (payload) => api.post('/medical-orders', payload),
  updateStatus: (id, status) => api.patch(`/medical-orders/${id}/status`, { status }),
  createResult: (id, payload) => api.post(`/medical-orders/${id}/results`, payload),
};

import api from '../../../shared/apis/api';

export const medicalOrderService = {
  list: (params = {}) => api.get('/medical-orders', { params }),
  create: (payload) => api.post('/medical-orders', payload),
  createResult: (id, payload) => api.post(`/medical-orders/${id}/results`, payload),
  getResultFileDownloadUrl: (fileId) => api.get(`/medical-orders/results/files/${fileId}/download`),
  updateStatus: (id, status) => api.patch(`/medical-orders/${id}/status`, { status }),
  uploadResultFiles: (id, files) => {
    const formData = new FormData();
    Array.from(files || []).forEach((file) => formData.append('files', file));
    return api.post(`/medical-orders/${id}/results/files`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

import api from '../../../shared/apis/api';

export const aiModelService = {
  list: (params = {}) => api.get('/ai-models', { params }),
  availableForDiagnosis: () => api.get('/ai-models/available-for-diagnosis'),
  create: (payload) => api.post('/ai-models', payload),
  update: (id, payload) => api.patch(`/ai-models/${id}`, payload),
  hide: (id) => api.patch(`/ai-models/${id}/hide`),
  restore: (id) => api.patch(`/ai-models/${id}/restore`),
  remove: (id) => api.delete(`/ai-models/${id}`),
  permanentDelete: (id) => api.delete(`/ai-models/${id}/permanent`),
  testApi: (payload) => api.post('/ai-models/test-api', payload),
  get: (id) => api.get(`/ai-models/${id}`),
  verifyOne: (id) => api.get(`/ai-models/${id}/audit/verify`),
  history: (id = null) => api.get(id ? `/ai-models/${id}/audit/history` : '/ai-models/audit/history'),
  rate: (id, payload) => api.post(`/ai-models/${id}/rate`, payload),
  stats: () => api.get('/ai-models/stats/overview'),
};

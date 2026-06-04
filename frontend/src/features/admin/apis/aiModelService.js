import api from '../../../shared/apis/api';

export const aiModelService = {
  list: (params = {}) => api.get('/ai-models', { params }),
  create: (payload) => api.post('/ai-models', payload),
  testApi: (payload) => api.post('/ai-models/test-api', payload),
  get: (id) => api.get(`/ai-models/${id}`),
  rate: (id, payload) => api.post(`/ai-models/${id}/rate`, payload),
  stats: () => api.get('/ai-models/stats/overview'),
};

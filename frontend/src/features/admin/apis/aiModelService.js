import api from '../../../shared/apis/api';

export const aiModelService = {
  list: (params = {}) => api.get('/ai-models', { params }),
  create: (payload) => api.post('/ai-models', payload),
  get: (id) => api.get(`/ai-models/${id}`),
};

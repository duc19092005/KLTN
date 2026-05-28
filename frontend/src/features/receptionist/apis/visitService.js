import api from '../../../shared/apis/api';

export const visitService = {
  search: (params = {}) => api.get('/visits', { params }),
  create: (payload) => api.post('/visits', payload),
  suggestRooms: (specialty) => api.get('/visits/suggest-rooms', { params: { specialty } }),
  updateStatus: (id, status) => api.patch(`/visits/${id}/status`, { status }),
};

import api from '../../../shared/apis/api';

export const clinicalRoomService = {
  search: (params = {}) => api.get('/clinical-rooms', { params }),
  create: (payload) => api.post('/clinical-rooms', payload),
  update: (id, payload) => api.patch(`/clinical-rooms/${id}`, payload),
  assignDoctor: (id, doctorId) => api.patch(`/clinical-rooms/${id}/doctor`, { doctorId }),
  remove: (id) => api.delete(`/clinical-rooms/${id}`),
};

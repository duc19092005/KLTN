import api from '../../../shared/apis/api';

export const doctorService = {
  search: (params = {}) => api.get('/doctors', { params }),
  create: (payload) => api.post('/doctors', payload),
  createFull: (payload) => api.post('/doctors/full', payload),
  update: (id, payload) => api.patch(`/doctors/${id}`, payload),
  assignRoom: (id, clinicalRoomId) => api.patch(`/doctors/${id}/clinical-room`, { clinicalRoomId }),
};

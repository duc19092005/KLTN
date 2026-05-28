import api from '../../../shared/apis/api';

export const doctorVisitService = {
  list: (params = {}) => api.get('/visits', { params }),
  updateStatus: (id, status) => api.patch(`/visits/${id}/status`, { status }),
};

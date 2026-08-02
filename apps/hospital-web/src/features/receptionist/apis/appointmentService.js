import api from '../../../shared/apis/api';

export const appointmentService = {
  async verifyQr(qrPayload) {
    const response = await api.post('/appointments/qr/verify', { qrPayload });
    return response.data;
  },

  async checkIn(qrPayload) {
    const response = await api.post('/appointments/check-in', { qrPayload });
    return response.data;
  },
};

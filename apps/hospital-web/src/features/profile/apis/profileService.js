import api from '../../../shared/apis/api';

export const profileService = {
  /** Fetch the current user's full personal information (Xem thông tin cá nhân). */
  getProfile: () => api.get('/auth/profile'),
};

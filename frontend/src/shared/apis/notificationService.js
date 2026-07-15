import api from '../../../shared/apis/api';

export const notificationService = {
  /** Get notifications with optional filters */
  list: (params = {}) => api.get('/notifications', { params }),

  /** Get unread count for badge */
  unreadCount: () => api.get('/notifications/unread-count'),

  /** Mark one notification as read */
  markRead: (id) => api.patch(`/notifications/${id}/read`),

  /** Mark all as read */
  markAllRead: () => api.patch('/notifications/read-all'),

  /** Delete a notification */
  delete: (id) => api.delete(`/notifications/${id}`),
};

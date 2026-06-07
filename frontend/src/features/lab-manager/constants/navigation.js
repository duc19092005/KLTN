export const LAB_MANAGER_NAV_ITEMS = [
  { id: 'overview', label: 'Tổng quan', icon: 'grid' },
  { id: 'shifts', label: 'Lịch trực', icon: 'calendar' },
  { id: 'history', label: 'Lịch sử', icon: 'clock' },
  { id: 'profile', label: 'Thông tin cá nhân', icon: 'user' },
];

export const LAB_MANAGER_ROUTES = {
  overview: '/lab-manager',
  shifts: '/lab-manager/shifts',
  history: '/lab-manager/history',
  profile: '/profile',
};

export function labManagerRouteFor(id) {
  return LAB_MANAGER_ROUTES[id] || LAB_MANAGER_ROUTES.overview;
}

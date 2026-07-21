export const LAB_MANAGER_NAV_ITEMS = [
  { id: 'overview', label: 'Tổng quan', icon: 'grid' },
  { id: 'orders', label: 'Phiếu CLS', icon: 'activity' },
  { id: 'results', label: 'Kết quả CLS', icon: 'file' },
  { id: 'profile', label: 'Thông tin cá nhân', icon: 'user' },
];

export const LAB_MANAGER_ROUTES = {
  overview: '/lab-manager',
  orders: '/lab-manager/orders',
  results: '/lab-manager/results',
  profile: '/profile',
};

export function labManagerRouteFor(id) {
  return LAB_MANAGER_ROUTES[id] || LAB_MANAGER_ROUTES.overview;
}

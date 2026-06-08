export const LAB_MANAGER_NAV_ITEMS = [
  { id: 'overview', label: 'Tong quan', icon: 'grid' },
  { id: 'orders', label: 'Phieu CLS', icon: 'activity' },
  { id: 'results', label: 'Ket qua CLS', icon: 'file' },
  { id: 'shifts', label: 'Lich truc', icon: 'calendar' },
  { id: 'history', label: 'Lich su', icon: 'clock' },
  { id: 'approvals', label: 'Duyet ca', icon: 'shield' },
  { id: 'profile', label: 'Thong tin ca nhan', icon: 'user' },
];

export const LAB_MANAGER_ROUTES = {
  overview: '/lab-manager',
  orders: '/lab-manager/orders',
  results: '/lab-manager/results',
  shifts: '/lab-manager/shifts',
  history: '/lab-manager/history',
  approvals: '/lab-manager/approvals',
  profile: '/profile',
};

export function labManagerRouteFor(id) {
  return LAB_MANAGER_ROUTES[id] || LAB_MANAGER_ROUTES.overview;
}

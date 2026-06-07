export const LAB_MANAGER_NAV_ITEMS = [
  { id: 'overview', label: 'Tổng quan', icon: 'grid' },
  { id: 'shifts', label: 'Lịch trực', icon: 'calendar' },
  { id: 'approveShifts', label: 'Duyệt lịch trực', icon: 'check-square' },
  { id: 'orders', label: 'Chỉ định xét nghiệm', icon: 'activity' },
  { id: 'results', label: 'Kết quả đã trả', icon: 'file' },
  { id: 'profile', label: 'Thông tin cá nhân', icon: 'user' },
];

export const LAB_MANAGER_ROUTES = {
  overview: '/lab-manager',
  shifts: '/lab-manager/shifts',
  approveShifts: '/admin/shifts',
  orders: '/lab-manager/orders',
  results: '/lab-manager/results',
  profile: '/profile',
};

export function labManagerRouteFor(id) {
  return LAB_MANAGER_ROUTES[id] || LAB_MANAGER_ROUTES.overview;
}

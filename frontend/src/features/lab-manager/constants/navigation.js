export const LAB_MANAGER_NAV_ITEMS = [
  { id: 'overview', label: 'Tổng quan', icon: 'grid' },
  { id: 'orders', label: 'Chỉ định xét nghiệm', icon: 'activity' },
  { id: 'results', label: 'Kết quả đã trả', icon: 'file' },
];

export const LAB_MANAGER_ROUTES = {
  overview: '/lab-manager',
  orders: '/lab-manager/orders',
  results: '/lab-manager/results',
};

export function labManagerRouteFor(id) {
  return LAB_MANAGER_ROUTES[id] || LAB_MANAGER_ROUTES.overview;
}

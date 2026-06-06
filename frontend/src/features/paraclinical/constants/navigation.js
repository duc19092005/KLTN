export const PARACLINICAL_NAV_ITEMS = [
  { id: 'overview', label: 'Tổng quan', icon: 'grid' },
  { id: 'shifts', label: 'Lịch trực', icon: 'calendar' },
  { id: 'orders', label: 'Chỉ định CLS', icon: 'activity' },
  { id: 'results', label: 'Kết quả đã trả', icon: 'file' },
];

export const PARACLINICAL_ROUTES = {
  overview: '/lab-manager',
  shifts: '/lab-manager/shifts',
  orders: '/lab-manager/orders',
  results: '/lab-manager/results',
};

export function paraclinicalRouteFor(id) {
  return PARACLINICAL_ROUTES[id] || PARACLINICAL_ROUTES.overview;
}

export const RECEPTIONIST_NAV_ITEMS = [
  { id: 'overview', label: 'Tổng quan', icon: 'grid' },
  { id: 'patient-intake', label: 'Tiếp nhận', icon: 'users' },
  { id: 'visit-queue', label: 'Hàng đợi khám', icon: 'activity' },
  { id: 'patient-records', label: 'Hồ sơ bệnh nhân', icon: 'file' },
];

export const RECEPTIONIST_ROUTES = {
  overview: '/receptionist',
  'patient-intake': '/receptionist/intake',
  'visit-queue': '/receptionist/queue',
  'patient-records': '/receptionist/records',
};

export function receptionistRouteFor(id) {
  return RECEPTIONIST_ROUTES[id] || RECEPTIONIST_ROUTES.overview;
}

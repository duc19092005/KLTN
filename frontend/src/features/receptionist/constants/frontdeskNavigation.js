// Navigation for receptionist intake operations.
export const FRONTDESK_NAV_ITEMS = [
  { id: 'patient-intake', label: 'Tiếp nhận', icon: 'users' },
  { id: 'visit-queue', label: 'Hàng đợi khám', icon: 'activity' },
  { id: 'patient-records', label: 'Hồ sơ bệnh nhân', icon: 'file' },
];

export const FRONTDESK_ROUTES = {
  'patient-intake': '/receptionist/intake',
  'visit-queue': '/receptionist/queue',
  'patient-records': '/receptionist/records',
};

export function frontdeskRouteFor(id) {
  return FRONTDESK_ROUTES[id] || FRONTDESK_ROUTES['patient-intake'];
}

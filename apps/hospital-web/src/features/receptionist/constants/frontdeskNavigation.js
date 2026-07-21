// Navigation for receptionist intake operations.
export const FRONTDESK_NAV_ITEMS = [
  { id: 'patient-intake', label: 'Tiếp nhận', icon: 'users' },
  { id: 'visit-queue', label: 'Hàng đợi khám', icon: 'activity' },
  { id: 'appointment-checkin', label: 'Check-in QR', icon: 'qr-code' },
  { id: 'patient-records', label: 'Hồ sơ bệnh nhân', icon: 'file' },
];

export const FRONTDESK_ROUTES = {
  'patient-intake': '/receptionist/intake',
  'visit-queue': '/receptionist/queue',
  'appointment-checkin': '/receptionist/appointments',
  'patient-records': '/receptionist/records',
};

export function frontdeskRouteFor(id) {
  return FRONTDESK_ROUTES[id] || FRONTDESK_ROUTES['patient-intake'];
}

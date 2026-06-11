// Personal receptionist account: patient intake, visit queue, records, and shift registration.
export const RECEPTIONIST_NAV_ITEMS = [
  { id: 'patient-intake', label: 'Tiếp nhận', icon: 'users' },
  { id: 'visit-queue', label: 'Hàng đợi khám', icon: 'activity' },
  { id: 'patient-records', label: 'Hồ sơ bệnh nhân', icon: 'file' },
  { id: 'shifts', label: 'Ca làm việc', icon: 'calendar' },
];

export const RECEPTIONIST_ROUTES = {
  overview: '/receptionist/intake',
  'patient-intake': '/receptionist/intake',
  'visit-queue': '/receptionist/queue',
  'patient-records': '/receptionist/records',
  shifts: '/receptionist/shifts',
  profile: '/profile',
};

export function receptionistRouteFor(id) {
  return RECEPTIONIST_ROUTES[id] || RECEPTIONIST_ROUTES.overview;
}

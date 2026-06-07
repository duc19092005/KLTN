// Personal receptionist account: patient intake, visit queue, and records.
// No more shift registration — receptionists log in and start working immediately.
export const RECEPTIONIST_NAV_ITEMS = [
  { id: 'patient-intake', label: 'Tiếp nhận', icon: 'users' },
  { id: 'visit-queue', label: 'Hàng đợi khám', icon: 'activity' },
  { id: 'patient-records', label: 'Hồ sơ bệnh nhân', icon: 'file' },
  { id: 'profile', label: 'Thông tin cá nhân', icon: 'user' },
];

export const RECEPTIONIST_ROUTES = {
  overview: '/receptionist/intake',
  'patient-intake': '/receptionist/intake',
  'visit-queue': '/receptionist/queue',
  'patient-records': '/receptionist/records',
  profile: '/profile',
};

export function receptionistRouteFor(id) {
  return RECEPTIONIST_ROUTES[id] || RECEPTIONIST_ROUTES.overview;
}

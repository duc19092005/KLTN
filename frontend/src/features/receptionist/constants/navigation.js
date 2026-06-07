// Personal receptionist account: only manages their own shift roster + profile.
// Patient intake / visit queue / records moved to the DEPT_SHARED workstation account
// (shared per administrative department, used at the front desk).
export const RECEPTIONIST_NAV_ITEMS = [
  { id: 'shifts', label: 'Lịch trực', icon: 'calendar' },
  { id: 'approveShifts', label: 'Duyệt lịch trực', icon: 'check-square' },
  { id: 'profile', label: 'Thông tin cá nhân', icon: 'user' },
];

export const RECEPTIONIST_ROUTES = {
  shifts: '/receptionist/shifts',
  approveShifts: '/admin/shifts',
  profile: '/profile',
};

export function receptionistRouteFor(id) {
  return RECEPTIONIST_ROUTES[id] || RECEPTIONIST_ROUTES.shifts;
}

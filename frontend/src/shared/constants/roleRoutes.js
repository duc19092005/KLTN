export const ROLE_DASHBOARD_ROUTES = {
  ADMIN: '/admin',
  RECEPTIONIST: '/receptionist',
  DOCTOR: '/doctor',
  LAB_MANAGER: '/lab-manager',
};

export function getDashboardRoute(role) {
  return ROLE_DASHBOARD_ROUTES[role] || '/login';
}

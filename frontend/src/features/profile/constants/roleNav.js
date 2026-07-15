import { ADMIN_NAV_ITEMS, ADMIN_ROUTES } from '../../admin/constants/navigation';
import { RECEPTIONIST_NAV_ITEMS, RECEPTIONIST_ROUTES } from '../../receptionist/constants/navigation';
import { LAB_MANAGER_NAV_ITEMS, LAB_MANAGER_ROUTES } from '../../lab-manager/constants/navigation';
import { DOCTOR_NAV_ITEMS } from '../../doctor/constants/navigation';

/**
 * The profile page is shared across every authenticated role, so it reuses each
 * role's own sidebar. This maps a role to its nav items and a navigate handler
 * (keyed by nav item id) so the sidebar stays consistent with the role's
 * dashboard.
 */
const ROLE_NAV = {
  ADMIN: {
    items: ADMIN_NAV_ITEMS,
    routeFor: (id) => ADMIN_ROUTES[id] || ADMIN_ROUTES.overview,
  },
  RECEPTIONIST: {
    items: RECEPTIONIST_NAV_ITEMS,
    routeFor: (id) => RECEPTIONIST_ROUTES[id] || RECEPTIONIST_ROUTES.overview,
  },
  LAB_MANAGER: {
    items: LAB_MANAGER_NAV_ITEMS,
    routeFor: (id) => LAB_MANAGER_ROUTES[id] || LAB_MANAGER_ROUTES.overview,
  },
  DOCTOR: {
    items: DOCTOR_NAV_ITEMS,
    routeFor: (id) => DOCTOR_NAV_ITEMS.find((item) => item.id === id)?.path || '/doctor',
  },
};

const FALLBACK = { items: [{ id: 'profile', label: 'Thông tin cá nhân', icon: 'user' }], routeFor: () => '/profile' };

export function getRoleNav(role) {
  return ROLE_NAV[role] || FALLBACK;
}

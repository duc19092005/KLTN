export const DOCTOR_NAV_ITEMS = [
  { id: 'overview', label: 'Tổng quan', icon: 'grid', path: '/doctor' },
  { id: 'queue', label: 'Hàng đợi khám', icon: 'activity', path: '/doctor/queue' },
];

export function navigateDoctor(navigate, id) {
  const item = DOCTOR_NAV_ITEMS.find((navItem) => navItem.id === id);
  navigate(item?.path || '/doctor');
}

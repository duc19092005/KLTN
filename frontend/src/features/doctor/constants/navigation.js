export const DOCTOR_NAV_ITEMS = [
  { id: 'overview', label: 'Tổng quan', icon: 'grid' },
  { id: 'queue', label: 'Hàng đợi khám', icon: 'activity' },
  { id: 'active-visit', label: 'Phiếu khám', icon: 'file' },
  { id: 'history', label: 'Hoàn tất', icon: 'shield' },
];

export function navigateDoctorSection(id) {
  const target = document.getElementById(`doctor-${id}`);
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

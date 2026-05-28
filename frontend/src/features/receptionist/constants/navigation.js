export const RECEPTIONIST_NAV_ITEMS = [
  { id: 'overview', label: 'Tổng quan', icon: 'grid' },
  { id: 'patient-intake', label: 'Tiếp nhận', icon: 'users' },
  { id: 'visit-queue', label: 'Hàng đợi khám', icon: 'activity' },
  { id: 'patient-records', label: 'Hồ sơ bệnh nhân', icon: 'file' },
];

export const RECEPTIONIST_SECTIONS = {
  overview: 'receptionist-overview',
  'patient-intake': 'patient-intake',
  'visit-queue': 'visit-queue',
  'patient-records': 'patient-records',
};

export function navigateReceptionistSection(id) {
  const element = document.getElementById(RECEPTIONIST_SECTIONS[id] || RECEPTIONIST_SECTIONS.overview);
  element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

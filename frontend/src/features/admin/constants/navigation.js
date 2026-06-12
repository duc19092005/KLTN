export const ADMIN_NAV_ITEMS = [
  { id: 'overview', label: 'Tổng quan', icon: 'grid' },
  { id: 'departments', label: 'Phòng ban', icon: 'file' },
  { id: 'staff', label: 'Nhân sự', icon: 'users' },
  { id: 'doctors', label: 'Bác sĩ', icon: 'stethoscope' },
  { id: 'aiModels', label: 'Mô hình AI', icon: 'activity' },
  { id: 'audit', label: 'Nhật ký', icon: 'shield' },
  { id: 'backup', label: 'Sao lưu', icon: 'database' },
  { id: 'profile', label: 'Thông tin cá nhân', icon: 'user' },
];

export const ADMIN_ROUTES = {
  overview: '/admin',
  departments: '/admin/departments',
  staff: '/admin/staff',
  doctors: '/admin/doctors',
  aiModels: '/admin/ai-models',
  audit: '/admin/audit',
  backup: '/admin/backup',
  profile: '/profile',
};

export function navigateAdmin(navigate, id) {
  navigate(ADMIN_ROUTES[id] || ADMIN_ROUTES.overview);
}

import React from 'react';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import { useAuth } from '../../../providers/AuthProvider';

const ROLE_LABELS = {
  ADMIN: 'Quản trị viên',
  RECEPTIONIST: 'Lễ tân',
  DOCTOR: 'Bác sĩ',
  LAB_MANAGER: 'Quản lý xét nghiệm',
};

export default function RoleDashboard({ title, subtitle }) {
  const { user, logout } = useAuth();
  const roleLabel = ROLE_LABELS[user?.role] || user?.role || 'Chưa xác định';
  return <DashboardLayout user={user} navItems={[]} activeItem="home" onNavigate={() => {}} onLogout={logout}><main className="max-w-[1500px] mx-auto"><section className="rounded-2xl border border-cyan-100 bg-gradient-to-br from-white via-cyan-50 to-slate-50 p-8 shadow-sm"><p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-600 mb-3">Không gian làm việc bệnh viện</p><h1 className="text-4xl font-black text-slate-950 tracking-tight">{title}</h1><p className="mt-3 text-slate-600 max-w-2xl">{subtitle}</p><div className="mt-6 rounded-2xl bg-white/80 border border-slate-100 p-4 text-sm text-slate-600"><b>Tài khoản:</b> {user?.username} · <b>Vai trò:</b> {roleLabel}</div></section></main></DashboardLayout>;
}

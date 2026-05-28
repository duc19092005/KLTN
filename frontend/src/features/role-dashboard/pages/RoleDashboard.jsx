import React from 'react';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import { useAuth } from '../../../providers/AuthProvider';

export default function RoleDashboard({ title, subtitle, tone = 'indigo' }) {
  const { user, logout } = useAuth();
  return <DashboardLayout user={user} navItems={[]} activeItem="home" onNavigate={() => {}} onLogout={logout}><main className="max-w-6xl mx-auto"><section className={`rounded-[32px] border border-${tone}-100 bg-gradient-to-br from-white via-${tone}-50 to-slate-50 p-8 shadow-sm`}><p className={`text-[11px] font-black uppercase tracking-[0.24em] text-${tone}-600 mb-3`}>Hospital Workspace</p><h1 className="text-4xl font-black text-slate-950 tracking-tight">{title}</h1><p className="mt-3 text-slate-600 max-w-2xl">{subtitle}</p><div className="mt-6 rounded-2xl bg-white/80 border border-slate-100 p-4 text-sm text-slate-600"><b>Tài khoản:</b> {user?.username} · <b>Role:</b> {user?.role}</div></section></main></DashboardLayout>;
}

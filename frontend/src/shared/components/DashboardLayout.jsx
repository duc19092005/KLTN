import React, { useState } from 'react';
import StepUpSessionBadge from './StepUpSessionBadge';
import SleepButton from './SleepButton';

const defaultNavItems = [
  { id: 'overview', label: 'Tổng quan', icon: 'grid' },
  { id: 'identity', label: 'Định danh', icon: 'shield' },
  { id: 'users', label: 'Người dùng', icon: 'users' },
  { id: 'records', label: 'Hồ sơ', icon: 'file' },
  { id: 'audit', label: 'Nhật ký', icon: 'activity' },
  { id: 'settings', label: 'Cài đặt', icon: 'settings' },
];

const ROLE_LABELS = {
  ADMIN: 'Quản trị viên',
  RECEPTIONIST: 'Lễ tân',
  DOCTOR: 'Bác sĩ',
  LAB_MANAGER: 'Quản lý xét nghiệm',
  DEPT_SHARED: 'Tài khoản phòng máy',
};

function SidebarIcon({ name, isActive, compact = false }) {
  const common = {
    className: `w-5 h-5 shrink-0 transition-all duration-300 ${compact ? '' : 'mr-3'} ${isActive ? 'scale-105 text-blue-600' : 'text-slate-400 group-hover:scale-105 group-hover:text-blue-500'}`,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: isActive ? 2.25 : 1.75,
    strokeLinecap: 'round',
    strokeLinejoin: 'round'
  };

  const icons = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M16 13H8" /><path d="M16 17H8" /><path d="M10 9H8" /></>,
    activity: <><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></>,
    settings: <><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" /><circle cx="12" cy="12" r="3" /></>,
    user: <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /></>,
    database: <><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" /><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" /></>,
  };

  return <svg {...common}>{icons[name] || icons.grid}</svg>;
}

export default function DashboardLayout({
  user,
  activeItem = 'overview',
  navItems = defaultNavItems,
  onNavigate,
  onLogout,
  children,
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const handleNavigate = (id) => {
    onNavigate?.(id);
    setIsSidebarOpen(false);
  };

  const activeLabel = navItems.find(item => item.id === activeItem)?.label || 'Tổng quan';
  const roleLabel = ROLE_LABELS[user?.role] || user?.role || 'Quản trị viên';

  const initials = (user?.username || user?.email || 'A')
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'A';

  return (
    <div className="flex h-screen w-full bg-[#F4F7FA] font-sans text-slate-800 overflow-hidden selection:bg-blue-100 selection:text-blue-700 antialiased">

      {/* OVERLAY FOR MOBILE/TABLET */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 
        transition-all duration-300 ease-in-out lg:static lg:translate-x-0
        ${isSidebarCollapsed ? 'lg:w-[92px]' : 'lg:w-[260px]'} w-[260px]
        ${isSidebarOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Brand / Logo Bệnh Viện */}
          <div className={`h-20 flex items-center border-b border-slate-100 transition-all duration-300 ${isSidebarCollapsed ? 'lg:justify-center lg:px-0' : 'justify-between px-6'}`}>
            <div className={`flex items-center min-w-0 ${isSidebarCollapsed ? 'lg:hidden' : ''}`}>
              <div className="w-9 h-9 bg-blue-600 text-white font-bold rounded-lg flex items-center justify-center mr-3 shrink-0 shadow-sm shadow-blue-200">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div className={`flex flex-col min-w-0 transition-all duration-200 ${isSidebarCollapsed ? 'lg:hidden' : ''}`}>
                <strong className="text-slate-900 text-[15px] font-bold tracking-tight leading-tight">Định danh Y tế</strong>
                <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider mt-0.5">Hệ thống bệnh viện</span>
              </div>
            </div>

            <button
              id="dashboard-sidebar-collapse-button"
              type="button"
              className={`hidden lg:flex rounded-xl border border-blue-100 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all duration-200 ${isSidebarCollapsed ? 'h-9 w-9 items-center justify-center' : 'p-1.5'}`}
              onClick={() => setIsSidebarCollapsed((value) => !value)}
              title={isSidebarCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
              aria-label={isSidebarCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
            >
              <svg className={`w-5 h-5 transition-transform duration-300 ${isSidebarCollapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Close Button on Mobile */}
            <button
              type="button"
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600"
              onClick={() => setIsSidebarOpen(false)}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation Items */}
          <nav className={`flex-1 overflow-y-auto py-6 space-y-1 transition-all duration-300 ${isSidebarCollapsed ? 'lg:px-4' : 'px-3'}`} aria-label="Điều hướng bảng làm việc">
            {navItems.map((item) => {
              const isActive = activeItem === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`group relative w-full flex items-center rounded-xl text-[14px] font-medium transition-all duration-200 ease-out outline-none focus-visible:ring-2 focus-visible:ring-blue-400
                    ${isSidebarCollapsed ? 'lg:justify-center lg:px-0 lg:py-3' : 'px-4 py-2.5'}
                    ${isActive
                      ? 'bg-blue-50/80 text-blue-700 font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  onClick={() => handleNavigate(item.id)}
                >
                  {/* Thanh sọc xanh nhỏ bên mép trái khi active */}
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-blue-600 rounded-r-full" />
                  )}
                  <SidebarIcon name={item.icon} isActive={isActive} compact={isSidebarCollapsed} />
                  <span className={`truncate transition-all duration-200 ${isSidebarCollapsed ? 'lg:hidden' : ''}`}>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Security Status Card (Y tế bảo mật) */}
          <div className={`p-4 border-t border-slate-100 transition-all duration-200 ${isSidebarCollapsed ? 'lg:hidden' : ''}`}>
            <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3 flex items-center gap-2.5">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Hệ thống an toàn</p>
                <p className="text-xs font-semibold text-emerald-950 truncate">MFA + chuẩn y tế</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 relative overflow-hidden transition-all duration-300">

        {/* TOPBAR */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 lg:px-8 sticky top-0 z-30 shrink-0">

          <div className="flex items-center gap-4">
            {/* Hamburger Button (Mobile/Tablet) */}
            <button
              type="button"
              className="lg:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-blue-600 border border-slate-200 transition-colors"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Mở thanh điều hướng"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Dynamic Page Titles */}
            <div className="min-w-0">
              <p className="hidden sm:block text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-0.5">Hệ thống định danh bệnh viện</p>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight truncate">{activeLabel}</h1>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3 sm:gap-4">

            {/* Search (Ẩn hẳn trên Mobile) */}
            <div className="relative hidden md:flex items-center">
              <svg className="w-4 h-4 absolute left-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Tra cứu nhanh..."
                className="pl-10 pr-4 py-1.5 bg-slate-50 border border-slate-200 text-sm rounded-lg focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all outline-none w-48 lg:w-60 text-slate-700 placeholder-slate-400"
              />
            </div>

            <div className="h-5 w-[1px] bg-slate-200 hidden md:block"></div>

            {/* Step-up privilege session countdown + lock */}
            <StepUpSessionBadge />


            {/* Profile Info */}
            <div className="flex items-center gap-2.5">
              <div className="text-right hidden sm:block">
                <strong className="block text-xs font-bold text-slate-900 leading-tight">{user?.username || 'Bác sĩ trực'}</strong>
                <span className="text-[11px] text-blue-600 font-semibold">{roleLabel}</span>
              </div>
              <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center text-xs font-bold shadow-sm">
                {initials}
              </div>
            </div>

            <div className="h-5 w-[1px] bg-slate-200"></div>

            {/* Sleep / lock screen */}
            <SleepButton />

            {/* Logout Button */}
            <button
              id="dashboard-logout-button"
              type="button"
              onClick={onLogout}
              className="p-2 rounded-xl bg-white hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors border border-slate-200 hover:border-red-100 outline-none"
              title="Đăng xuất"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#F8FAFC] scroll-smooth">
          {children}
        </main>

      </div>
    </div>
  );
}

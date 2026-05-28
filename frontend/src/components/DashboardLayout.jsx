import React, { useState, useEffect } from 'react';

const defaultNavItems = [
  { id: 'overview', label: 'Tổng quan', icon: 'grid' },
  { id: 'identity', label: 'Định danh', icon: 'shield' },
  { id: 'users', label: 'Người dùng', icon: 'users' },
  { id: 'records', label: 'Hồ sơ', icon: 'file' },
  { id: 'audit', label: 'Nhật ký', icon: 'activity' },
  { id: 'settings', label: 'Cài đặt', icon: 'settings' },
];

function SidebarIcon({ name, isActive }) {
  const common = {
    className: `w-5 h-5 mr-3 shrink-0 transition-all duration-300 ${isActive ? 'scale-105' : 'group-hover:scale-105'}`,
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

  // Tự động đóng sidebar khi chuyển trang trên thiết bị di động
  const handleNavigate = (id) => {
    onNavigate?.(id);
    setIsSidebarOpen(false);
  };

  // Lấy tên tiêu đề hiện tại dựa trên activeItem
  const activeLabel = navItems.find(item => item.id === activeItem)?.label || 'Dashboard';

  const initials = (user?.username || user?.email || 'A')
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'A';

  return (
    <div className="flex h-screen w-full bg-[#F8FAFC] font-sans text-slate-800 overflow-hidden selection:bg-blue-50 selection:text-blue-600 antialiased">

      {/* OVERLAY FOR MOBILE (Mờ nền khi mở Sidebar trên mobile) */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR (Responsive chuẩn) */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-[260px] bg-white border-r border-slate-200/80 flex flex-col justify-between shrink-0 
        transition-transform duration-300 ease-in-out lg:static lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Brand */}
          <div className="h-20 flex items-center justify-between px-6 border-b border-slate-100">
            <div className="flex items-center">
              <div className="w-9 h-9 bg-slate-900 text-white font-black rounded-xl flex items-center justify-center mr-3 shrink-0 shadow-sm">
                ZK
              </div>
              <div className="flex flex-col">
                <strong className="text-slate-900 text-[14px] font-bold tracking-tight leading-tight">KLTN Identity</strong>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">Secure OS</span>
              </div>
            </div>

            {/* Nút đóng Sidebar trên Mobile */}
            <button
              type="button"
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700"
              onClick={() => setIsSidebarOpen(false)}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-6 px-3.5 space-y-1" aria-label="Dashboard navigation">
            {navItems.map((item) => {
              const isActive = activeItem === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`group w-full flex items-center px-3.5 py-2.5 rounded-xl text-[14px] font-medium transition-all duration-200 ease-out outline-none focus-visible:ring-2 focus-visible:ring-slate-400
                    ${isActive
                      ? 'bg-slate-900 text-white shadow-sm font-semibold'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  onClick={() => handleNavigate(item.id)}
                >
                  <SidebarIcon name={item.icon} isActive={isActive} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Security Status Card (Tinh chỉnh sang chảnh, tối giản hơn) */}
          <div className="p-4 border-t border-slate-100">
            <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3.5 flex items-center gap-3">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">MFA Secured</p>
                <p className="text-xs font-semibold text-slate-700 truncate">Wallet + FaceID</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 relative overflow-hidden">

        {/* TOPBAR */}
        <header className="h-20 bg-white border-b border-slate-200/80 flex items-center justify-between px-4 sm:px-6 lg:px-8 sticky top-0 z-30 shrink-0">

          <div className="flex items-center gap-4">
            {/* Hamburger Button (Chỉ hiện trên Mobile/Tablet) */}
            <button
              type="button"
              className="lg:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 border border-slate-200"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Page Titles Dynamic */}
            <div className="min-w-0">
              <p className="hidden sm:block text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-0.5">Admin Control Center</p>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight truncate">{activeLabel}</h1>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3 sm:gap-4">

            {/* Search (Ẩn hẳn trên Mobile, thu gọn trên Tablet) */}
            <div className="relative hidden md:flex items-center">
              <svg className="w-4 h-4 absolute left-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Tìm kiếm..."
                className="pl-10 pr-4 py-1.5 bg-slate-50 border border-slate-200 text-sm rounded-lg focus:bg-white focus:border-slate-400 focus:ring-0 transition-all outline-none w-48 lg:w-60 text-slate-700 placeholder-slate-400"
              />
            </div>

            <div className="h-5 w-[1px] bg-slate-200 hidden md:block"></div>

            {/* Profile Info */}
            <div className="flex items-center gap-2.5">
              <div className="text-right hidden sm:block">
                <strong className="block text-xs font-semibold text-slate-900 leading-tight">{user?.username || 'Admin User'}</strong>
                <span className="text-[11px] text-slate-400 font-medium">{user?.role || 'Super Admin'}</span>
              </div>
              <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center text-xs font-bold shadow-sm">
                {initials}
              </div>
            </div>

            <div className="h-5 w-[1px] bg-slate-200"></div>

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
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 scroll-smooth">
          {children}
        </main>

      </div>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutGrid,
  ShieldCheck,
  Users,
  FileText,
  Activity,
  Settings,
  User,
  Calendar,
  Database,
  Stethoscope,
  Building2,
  Clock,
  Plus,
  ChevronLeft,
  X,
  Menu,
  Search,
  LogOut,
  Trash2,
  Sparkles,
} from 'lucide-react';
import NotificationBell from './NotificationBell';
import LiveClock from './LiveClock';

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
};

const ICON_COMPONENTS = {
  grid: LayoutGrid,
  shield: ShieldCheck,
  users: Users,
  file: FileText,
  activity: Activity,
  settings: Settings,
  user: User,
  calendar: Calendar,
  clock: Clock,
  database: Database,
  stethoscope: Stethoscope,
  building: Building2,
  trash: Trash2,
};

function SidebarIcon({ name, isActive, compact = false }) {
  const Icon = ICON_COMPONENTS[name] || LayoutGrid;
  const className = `w-4.5 h-4.5 shrink-0 transition-transform duration-300 ${
    isActive
      ? 'scale-110 text-sky-600 font-bold'
      : 'text-slate-400 group-hover:scale-110 group-hover:text-sky-500'
  }`;
  return <Icon className={className} strokeWidth={isActive ? 2.25 : 1.75} />;
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('admin_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebarCollapsed = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('admin_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const navigate = useNavigate();

  const openProfile = () => {
    setIsSidebarOpen(false);
    navigate('/profile', { state: { tab: 'profile' } });
  };
  const openSettings = () => {
    setIsSidebarOpen(false);
    navigate('/profile', { state: { tab: 'personalize' } });
  };

  const filteredNavItems = navItems;
  const activeIndex = filteredNavItems.findIndex((item) => item.id === activeItem);

  // Persistent index for ultra-smooth sliding animation across route transitions
  const [sliderIndex, setSliderIndex] = useState(() => {
    try {
      const prev = sessionStorage.getItem('admin_nav_prev_index');
      if (prev !== null && !isNaN(Number(prev))) {
        return Number(prev);
      }
    } catch {}
    return activeIndex !== -1 ? activeIndex : 0;
  });

  useEffect(() => {
    if (activeIndex !== -1) {
      const raf = requestAnimationFrame(() => {
        setSliderIndex(activeIndex);
        try {
          sessionStorage.setItem('admin_nav_prev_index', String(activeIndex));
        } catch {}
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [activeIndex]);

  const handleNavigate = (id) => {
    try {
      sessionStorage.setItem('admin_nav_prev_index', String(activeIndex));
    } catch {}
    onNavigate?.(id);
    setIsSidebarOpen(false);
  };

  const activeLabel = filteredNavItems.find((item) => item.id === activeItem)?.label || 'Tổng quan';
  const roleLabel = ROLE_LABELS[user?.role] || user?.role || 'Quản trị viên';

  const initials = (user?.fullName || user?.username || user?.email || 'A')
    .trim()
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'A';

  return (
    <div className="flex h-screen w-full bg-[#F8FAFC] font-sans text-slate-800 overflow-hidden selection:bg-sky-100 selection:text-sky-700 antialiased">
      {/* OVERLAY FOR MOBILE/TABLET */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`
        fixed inset-y-0 left-0 z-50 bg-white border-r border-slate-200/80 flex flex-col justify-between shrink-0
        transition-all duration-300 ease-in-out lg:static lg:translate-x-0
        ${isSidebarCollapsed ? 'lg:w-[84px]' : 'lg:w-[260px]'} w-[260px]
        ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
      `}
      >
        <div className="flex flex-col h-full">
          {/* Brand / Logo Bệnh Viện */}
          <div
            className={`h-20 flex items-center border-b border-slate-100 transition-colors duration-300 ${
              isSidebarCollapsed ? 'lg:justify-center lg:px-0' : 'justify-between px-6'
            }`}
          >
            <div className={`flex items-center min-w-0 ${isSidebarCollapsed ? 'lg:hidden' : ''}`}>
              <div className="w-10 h-10 bg-sky-600 text-white font-black rounded-2xl flex items-center justify-center mr-3 shrink-0 shadow-md shadow-sky-600/30">
                K
              </div>
              <div className={`flex flex-col min-w-0 ${isSidebarCollapsed ? 'lg:hidden' : ''}`}>
                <strong className="text-slate-900 text-[15px] font-bold tracking-tight leading-tight whitespace-nowrap">
                  Bệnh Viện KLTN
                </strong>
                <span className="text-[10px] text-sky-600 font-bold uppercase tracking-wider mt-0.5 whitespace-nowrap">
                  Hệ thống Quản trị
                </span>
              </div>
            </div>

            <button
              id="dashboard-sidebar-collapse-button"
              type="button"
              className={`hidden lg:flex rounded-xl border border-slate-200/80 bg-slate-50 text-slate-500 hover:bg-sky-600 hover:text-white hover:border-sky-600 transition-all duration-200 ${
                isSidebarCollapsed ? 'h-9 w-9 items-center justify-center' : 'p-1.5'
              }`}
              onClick={toggleSidebarCollapsed}
              title={isSidebarCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
              aria-label={isSidebarCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
            >
              <ChevronLeft
                className={`w-4.5 h-4.5 transition-transform duration-300 ${
                  isSidebarCollapsed ? 'rotate-180' : ''
                }`}
                strokeWidth={2}
              />
            </button>

            <button
              type="button"
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600"
              onClick={() => setIsSidebarOpen(false)}
            >
              <X className="w-5 h-5" strokeWidth={2} />
            </button>
          </div>

          {/* Navigation Items with Cross-Route Liquid-Smooth Sliding Active Background Frame */}
          <nav
            className="relative flex-1 overflow-y-auto py-5 px-3 transition-all duration-300"
            aria-label="Điều hướng bảng làm việc"
          >
            {/* Liquid-Smooth Sliding Active Background Frame */}
            {activeIndex !== -1 && (
              <div
                className="absolute top-5 left-3 right-3 h-11 bg-sky-50/90 border border-sky-200/90 rounded-xl shadow-[0_2px_12px_-2px_rgba(2,132,199,0.18)] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-none"
                style={{
                  transform: `translateY(${sliderIndex * 50}px)`,
                }}
              />
            )}

            {filteredNavItems.map((item) => {
              const isActive = activeItem === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`group relative z-10 w-full h-11 mb-1.5 flex items-center px-3.5 rounded-xl text-[13.5px] font-bold transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-sky-400
                    ${isSidebarCollapsed ? 'lg:justify-center lg:px-0' : 'gap-3'}
                    ${
                      isActive
                        ? 'text-sky-800 font-extrabold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  onClick={() => handleNavigate(item.id)}
                >
                  <SidebarIcon name={item.icon} isActive={isActive} compact={isSidebarCollapsed} />
                  <span
                    className={`truncate transition-colors duration-200 ${
                      isSidebarCollapsed ? 'lg:hidden' : ''
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Bottom Profile & Settings */}
          <div
            className={`p-4 border-t border-slate-100 mt-2 flex items-center gap-2 ${
              isSidebarCollapsed ? 'lg:flex-col lg:justify-center' : 'justify-center'
            }`}
          >
            <button
              id="sidebar-profile-button"
              type="button"
              onClick={openProfile}
              title="Thông tin cá nhân"
              aria-label="Thông tin cá nhân"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-sky-700 border border-sky-200 text-xs font-black shadow-xs hover:bg-sky-600 hover:text-white transition-all"
            >
              {initials}
            </button>
            <button
              id="sidebar-settings-button"
              type="button"
              onClick={openSettings}
              title="Cài đặt"
              aria-label="Cài đặt người dùng"
              className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 hover:text-sky-600 hover:bg-sky-50 border border-transparent hover:border-sky-100 transition-all"
            >
              <Settings className="w-5 h-5" strokeWidth={2} />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA WITH ULTRA-SMOOTH PAGE ENTER ANIMATION */}
      <div className="flex-1 flex flex-col min-w-0 relative overflow-hidden transition-all duration-300">
        {/* TOPBAR */}
        <header className="h-20 bg-white/95 border-b border-slate-200/80 flex items-center justify-between px-4 sm:px-6 lg:px-8 sticky top-0 z-30 shrink-0 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="lg:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-sky-600 border border-slate-200 transition-colors"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Mở thanh điều hướng"
            >
              <Menu className="w-5 h-5" strokeWidth={2} />
            </button>

            <div className="min-w-0">
              <p className="hidden sm:block text-[10px] font-bold text-sky-600 uppercase tracking-widest mb-0.5">
                Bệnh Viện Đa Khoa KLTN
              </p>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight truncate">
                {activeLabel}
              </h1>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative hidden md:flex items-center">
              <Search className="w-4 h-4 absolute left-3.5 text-slate-400" strokeWidth={2} />
              <input
                type="text"
                placeholder="Tra cứu nhanh..."
                className="pl-10 pr-4 py-1.5 bg-slate-50 border border-slate-200 text-xs font-semibold rounded-xl focus:bg-white focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition-colors outline-none w-48 lg:w-60 text-slate-700 placeholder-slate-400"
              />
            </div>

            <div className="h-5 w-[1px] bg-slate-200 hidden md:block"></div>

            <div className="hidden sm:flex">
              <LiveClock />
            </div>

            <NotificationBell />

            <div className="flex items-center gap-2.5">
              <div className="text-right hidden sm:block">
                <strong className="block text-xs font-bold text-slate-900 leading-tight">
                  {user?.fullName || user?.username || 'Bác sĩ trực'}
                </strong>
                <span className="text-[11px] text-sky-600 font-semibold">{roleLabel}</span>
              </div>
              <div className="w-9 h-9 rounded-full bg-sky-100 text-sky-700 border border-sky-200 flex items-center justify-center text-xs font-bold shadow-xs">
                {initials}
              </div>
            </div>

            <div className="h-5 w-[1px] bg-slate-200"></div>

            <button
              id="dashboard-logout-button"
              type="button"
              onClick={onLogout}
              className="p-2 rounded-xl bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors border border-slate-200 hover:border-rose-100 outline-none"
              title="Đăng xuất"
            >
              <LogOut className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        </header>

        {/* PAGE CONTENT WITH ULTRA-SMOOTH TAB CHANGE ANIMATION */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#F8FAFC] scroll-smooth">
          <div key={activeItem} className="animate-tab-smooth">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

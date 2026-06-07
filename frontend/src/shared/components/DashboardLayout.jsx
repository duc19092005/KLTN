import React, { useState } from 'react';
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
} from 'lucide-react';
import StepUpSessionBadge from './StepUpSessionBadge';
import SleepButton from './SleepButton';
import NotificationBell from './NotificationBell';
import LiveClock from './LiveClock';
import DemoModeToggle from './DemoModeToggle';

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

// Map sidebar item.icon string -> Lucide component. Centralized so callers can keep using the
// existing string-based API (e.g. `{ icon: 'grid' }`) without importing Lucide directly.
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
};

function SidebarIcon({ name, isActive, compact = false }) {
  const Icon = ICON_COMPONENTS[name] || LayoutGrid;
  const className = `w-5 h-5 shrink-0 transition-all duration-300 ${compact ? '' : 'mr-3'} ${
    isActive
      ? 'scale-105 text-blue-600'
      : 'text-slate-400 group-hover:scale-105 group-hover:text-blue-500'
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const navigate = useNavigate();

  // Both the avatar icon and the gear go to the shared user page (/profile) for every role, but to
  // different tabs: the avatar opens personal info, the gear opens the settings/personalization tab.
  // Using useNavigate directly keeps it self-contained so callers don't each need to wire it up.
  const openProfile = () => {
    setIsSidebarOpen(false);
    navigate('/profile', { state: { tab: 'profile' } });
  };
  const openSettings = () => {
    setIsSidebarOpen(false);
    navigate('/profile', { state: { tab: 'personalize' } });
  };

  const handleNavigate = (id) => {
    onNavigate?.(id);
    setIsSidebarOpen(false);
  };

  const filteredNavItems = navItems.filter((item) => {
    if (item.id === 'approveShifts') {
      return user?.role === 'ADMIN' || user?.isManager === true;
    }
    return true;
  });

  const activeLabel = filteredNavItems.find(item => item.id === activeItem)?.label || 'Tổng quan';
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
                <Plus className="w-5 h-5" strokeWidth={2.5} />
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
              <ChevronLeft className={`w-5 h-5 transition-transform duration-300 ${isSidebarCollapsed ? 'rotate-180' : ''}`} strokeWidth={2} />
            </button>

            {/* Close Button on Mobile */}
            <button
              type="button"
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600"
              onClick={() => setIsSidebarOpen(false)}
            >
              <X className="w-5 h-5" strokeWidth={2} />
            </button>
          </div>

          {/* Navigation Items */}
          <nav className={`flex-1 overflow-y-auto py-6 space-y-1 transition-all duration-300 ${isSidebarCollapsed ? 'lg:px-4' : 'px-3'}`} aria-label="Điều hướng bảng làm việc">
            {filteredNavItems.map((item) => {
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
          <div className={`px-4 pt-4 transition-all duration-200 ${isSidebarCollapsed ? 'lg:hidden' : ''}`}>
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

          {/* Profile + Settings (đáy sidebar). Avatar mở thông tin cá nhân, bánh răng mở cài đặt. */}
          <div className={`p-4 border-t border-slate-100 mt-3 flex items-center gap-2 ${isSidebarCollapsed ? 'lg:flex-col lg:justify-center' : 'justify-center'}`}>
            <button
              id="sidebar-profile-button"
              type="button"
              onClick={openProfile}
              title="Thông tin cá nhân"
              aria-label="Thông tin cá nhân"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600 border border-blue-100 text-sm font-bold shadow-sm hover:bg-blue-600 hover:text-white transition-all"
            >
              {initials}
            </button>
            <button
              id="sidebar-settings-button"
              type="button"
              onClick={openSettings}
              title="Cài đặt"
              aria-label="Cài đặt người dùng"
              className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition-all"
            >
              <Settings className="w-5 h-5" strokeWidth={2} />
            </button>
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
              <Menu className="w-5 h-5" strokeWidth={2} />
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
              <Search className="w-4 h-4 absolute left-3.5 text-slate-400" strokeWidth={2} />
              <input
                type="text"
                placeholder="Tra cứu nhanh..."
                className="pl-10 pr-4 py-1.5 bg-slate-50 border border-slate-200 text-sm rounded-lg focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all outline-none w-48 lg:w-60 text-slate-700 placeholder-slate-400"
              />
            </div>


            <div className="h-5 w-[1px] bg-slate-200 hidden md:block"></div>

            {/* Live clock */}
            <div className="hidden sm:flex">
              <LiveClock />
            </div>

            {/* Demo mode toggle */}
            <div className="hidden sm:flex">
              <DemoModeToggle />
            </div>

            {/* Step-up privilege session countdown + lock */}
            <StepUpSessionBadge />

            {/* Notifications */}
            <NotificationBell />


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
              <LogOut className="w-4 h-4" strokeWidth={2} />
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

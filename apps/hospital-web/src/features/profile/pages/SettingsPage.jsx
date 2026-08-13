import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import { useAuth } from '../../../providers/AuthProvider';
import { useToast } from '../../../providers/ToastProvider';
import { getRoleNav } from '../constants/roleNav';
import PreferencesPanel from '../components/PreferencesPanel';
import ChangePasswordModal from '../components/ChangePasswordModal';
import {
  Settings,
  ShieldCheck,
  KeyRound,
  Bell,
  Sliders,
  Sparkles,
  Cpu,
  User,
  CheckCircle2,
  Lock,
  Smartphone,
  ExternalLink,
  Volume2,
  RefreshCw,
} from 'lucide-react';

const ROLE_LABELS = {
  ADMIN: 'Quản trị viên',
  RECEPTIONIST: 'Lễ tân',
  DOCTOR: 'Bác sĩ',
  LAB_MANAGER: 'Quản lý xét nghiệm',
};

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [showChangePassword, setShowChangePassword] = useState(false);

  // Sound and Notification preferences state
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try { return localStorage.getItem('pref_sound') !== 'false'; } catch { return true; }
  });
  const [autoRefresh, setAutoRefresh] = useState(() => {
    try { return localStorage.getItem('pref_auto_refresh') !== 'false'; } catch { return true; }
  });

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    try { localStorage.setItem('pref_sound', String(next)); } catch {}
    toast.success(next ? 'Đã bật âm thanh thông báo' : 'Đã tắt âm thanh thông báo');
  };

  const toggleAutoRefresh = () => {
    const next = !autoRefresh;
    setAutoRefresh(next);
    try { localStorage.setItem('pref_auto_refresh', String(next)); } catch {}
    toast.success(next ? 'Đã bật tự động đồng bộ dữ liệu' : 'Đã tắt tự động đồng bộ');
  };

  const roleNav = getRoleNav(user?.role);
  const roleLabel = ROLE_LABELS[user?.role] || user?.role || 'Người dùng';
  const canChangePassword = user?.role !== 'ADMIN';

  return (
    <DashboardLayout
      user={user}
      navItems={roleNav.items}
      activeItem="settings"
      onNavigate={(id) => navigate(roleNav.routeFor(id))}
      onLogout={logout}
    >
      <div className="max-w-[1280px] mx-auto space-y-8 pb-12 animate-in fade-in duration-300">
        {/* Header Hero Banner */}
        <section className="relative overflow-hidden rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50/90 via-white to-cyan-50/70 p-8 sm:p-10 text-slate-900 shadow-sm">
          {/* Subtle Background Glow Accent */}
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-sky-200/30 blur-3xl pointer-events-none" />
          <div className="absolute right-1/3 -bottom-20 h-56 w-56 rounded-full bg-cyan-200/25 blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-100/80 px-3.5 py-1 text-xs font-bold text-sky-800 shadow-2xs">
                <Sparkles className="h-3.5 w-3.5 text-sky-600" />
                <span>Hệ thống Tùy chỉnh & Bảo mật</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 flex items-center gap-3">
                <Settings className="h-8 w-8 text-sky-600 shrink-0" strokeWidth={2.25} />
                Cài đặt & Tùy biến
              </h1>
              <p className="text-sm font-medium text-slate-600 max-w-2xl leading-relaxed">
                Tùy chỉnh giao diện làm việc, thiết lập ưu tiên thông báo và quản lý cấu hình an toàn sinh trắc học cho tài khoản <strong className="text-sky-700">{roleLabel}</strong>.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0 self-start md:self-center">
              <button
                type="button"
                onClick={() => navigate('/profile')}
                className="flex items-center gap-2 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 px-5 py-3 text-xs font-bold text-slate-700 transition-all shadow-xs"
              >
                <User className="h-4 w-4 text-sky-600" />
                <span>Xem Hồ sơ</span>
              </button>
            </div>
          </div>
        </section>

        {/* Section 1: Appearance Preferences */}
        <section className="space-y-4">
          <div className="flex items-center gap-2.5 px-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-100 text-sky-700 font-bold">
              <Sliders className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Giao diện & Chủ đề</h2>
              <p className="text-xs text-slate-500 font-medium">Thay đổi tông màu điểm nhấn và tùy chỉnh hiển thị theo sở thích cá nhân</p>
            </div>
          </div>

          <PreferencesPanel />
        </section>

        {/* Section 2: Security & Authentication Settings */}
        <section className="space-y-4">
          <div className="flex items-center gap-2.5 px-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 font-bold">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Bảo mật & Sinh trắc học</h2>
              <p className="text-xs text-slate-500 font-medium">Trạng thái xác thực khuôn mặt Face ID, tài khoản và mật khẩu</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Biometric Verification Card */}
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                    <Smartphone className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Xác thực khuôn mặt (Face ID)</h3>
                    <p className="text-xs font-semibold text-slate-500 mt-0.5">Sinh trắc học AI bảo mật cao</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {user?.hasFace ? 'Đã kích hoạt' : 'Chưa đăng ký'}
                </span>
              </div>

              <p className="mt-4 text-xs text-slate-600 font-medium leading-relaxed">
                Dữ liệu khuôn mặt của bạn đã được đăng ký và lưu trữ an toàn trong hệ thống bệnh viện. Được sử dụng để xác thực nhanh và bảo vệ quyền truy cập tài khoản.
              </p>

              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Công nghệ AI: Nhận diện sinh trắc học</span>
                <button
                  type="button"
                  onClick={() => navigate('/authenticate')}
                  className="flex items-center gap-1.5 text-xs font-bold text-sky-600 hover:text-sky-700 transition"
                >
                  <span>Kiểm tra khuôn mặt</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Account Password Card */}
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 border border-sky-100">
                      <KeyRound className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Mật khẩu đăng nhập</h3>
                      <p className="text-xs font-semibold text-slate-500 mt-0.5">Quản lý bảo vệ tài khoản</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">
                    <Lock className="h-3.5 w-3.5" />
                    Mã hóa an toàn
                  </span>
                </div>

                <p className="mt-4 text-xs text-slate-600 font-medium leading-relaxed">
                  {canChangePassword
                    ? 'Nên thay đổi mật khẩu định kỳ để đảm bảo an toàn tối đa cho tài khoản làm việc của bạn.'
                    : 'Tài khoản Quản trị viên sử dụng phương thức đăng nhập bằng xác thực sinh trắc học và ví bảo mật.'}
                </p>
              </div>

              {canChangePassword && (
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Lần đổi gần nhất: Gần đây</span>
                  <button
                    type="button"
                    onClick={() => setShowChangePassword(true)}
                    className="rounded-xl bg-sky-600 hover:bg-sky-700 px-4 py-2 text-xs font-bold text-white transition shadow-xs"
                  >
                    Đổi mật khẩu
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Section 3: Notification & System Settings */}
        <section className="space-y-4">
          <div className="flex items-center gap-2.5 px-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700 font-bold">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Thông báo & Hệ thống</h2>
              <p className="text-xs text-slate-500 font-medium">Tùy chỉnh thông báo âm thanh và tần suất tự động đồng bộ</p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-5">
            {/* Audio notifications */}
            <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <Volume2 className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Âm thanh chuông báo</h4>
                  <p className="text-xs text-slate-500 font-semibold">Phát chuông thông báo khi có lượt khám mới hoặc kết quả xét nghiệm</p>
                </div>
              </div>
              <button
                type="button"
                onClick={toggleSound}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  soundEnabled ? 'bg-sky-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    soundEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Auto refresh */}
            <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <RefreshCw className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Tự động làm mới danh sách hàng đợi</h4>
                  <p className="text-xs text-slate-500 font-semibold">Đồng bộ danh sách khám bệnh mỗi 30 giây mà không cần bấm F5</p>
                </div>
              </div>
              <button
                type="button"
                onClick={toggleAutoRefresh}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  autoRefresh ? 'bg-sky-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    autoRefresh ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* Section 4: Admin Blockchain & Node Status (if ADMIN) */}
        {user?.role === 'ADMIN' && (
          <section className="space-y-4">
            <div className="flex items-center gap-2.5 px-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700 font-bold">
                <Cpu className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Hệ thống Bảo vệ & Lưu trữ Dữ liệu</h2>
                <p className="text-xs text-slate-500 font-medium">Trạng thái kết nối hạ tầng bảo mật dữ liệu y tế và sao lưu tự động</p>
              </div>
            </div>

            <div className="rounded-3xl border border-cyan-200/80 bg-gradient-to-br from-cyan-50/40 via-white to-sky-50/40 p-6 shadow-sm">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-white border border-slate-200/80">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Mạng lưu trữ an toàn</span>
                  <div className="mt-1 flex items-center gap-2 font-bold text-slate-900 text-sm">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    Hệ thống xác thực phi tập trung
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-white border border-slate-200/80">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Nhật ký kiểm toán</span>
                  <div className="mt-1 font-bold text-slate-900 text-sm">Hệ thống kiểm tra toàn vẹn</div>
                </div>
                <div className="p-4 rounded-2xl bg-white border border-slate-200/80">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Sao lưu dữ liệu</span>
                  <div className="mt-1 font-bold text-slate-900 text-sm">Sao lưu dữ liệu đám mây</div>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
    </DashboardLayout>
  );
}

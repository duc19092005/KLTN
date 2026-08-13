import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { useToast } from '../../../providers/ToastProvider';
import { profileService } from '../apis/profileService';
import { getRoleNav } from '../constants/roleNav';
import ChangePasswordModal from '../components/ChangePasswordModal';
import { usePreferences } from '../../../providers/PreferencesProvider';
import {
  User,
  ShieldCheck,
  KeyRound,
  Building2,
  Stethoscope,
  Award,
  Calendar,
  CheckCircle2,
  Smartphone,
  SlidersHorizontal,
  Mail,
  Phone,
  CreditCard,
  Briefcase,
  ExternalLink,
  Sparkles,
  Lock,
} from 'lucide-react';

const ROLE_LABELS = {
  ADMIN: 'Quản trị viên',
  RECEPTIONIST: 'Lễ tân',
  DOCTOR: 'Bác sĩ',
  LAB_MANAGER: 'Quản lý xét nghiệm',
};

const STATUS_LABELS = {
  ACTIVE: { text: 'Đang hoạt động', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  INACTIVE: { text: 'Ngưng hoạt động', tone: 'bg-rose-50 text-rose-700 border-rose-200' },
  PENDING: { text: 'Chờ kích hoạt', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
};

function formatDateTime(value) {
  return value
    ? new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
    : 'Chưa cập nhật';
}

function formatDate(value) {
  return value
    ? new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : 'Chưa cập nhật';
}

function shortenWallet(address) {
  if (!address) return 'Chưa liên kết';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { accentHex } = usePreferences();
  const navigate = useNavigate();
  const toast = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showChangePassword, setShowChangePassword] = useState(false);

  const roleNav = getRoleNav(user?.role);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const res = await profileService.getProfile();
        if (mounted) setProfile(res.data?.profile || null);
      } catch (err) {
        if (mounted) toast.error(err.response?.data?.message || 'Không tải được thông tin cá nhân');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const account = profile?.account;
  const staff = profile?.staff;
  const doctor = profile?.doctor;
  const admin = profile?.admin;

  const canChangePassword = Boolean(account) && account.role !== 'ADMIN';

  const displayName = staff?.fullName || admin?.adminUserName || account?.username || user?.username || 'Người dùng';
  const roleLabel = ROLE_LABELS[account?.role || user?.role] || account?.role || user?.role;
  const status = STATUS_LABELS[account?.status] || { text: account?.status || 'Hoạt động', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  const initials = displayName
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U';

  return (
    <DashboardLayout
      user={user}
      navItems={roleNav.items}
      activeItem="profile"
      onNavigate={(id) => navigate(roleNav.routeFor(id))}
      onLogout={logout}
    >
      <div className="max-w-[1280px] mx-auto space-y-8 pb-12 animate-in fade-in duration-300">
        {loading ? (
          <div className="py-20">
            <LoadingIndicator size="lg" label="Đang tải thông tin hồ sơ cá nhân..." />
          </div>
        ) : !profile ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-12 text-center shadow-xs">
            <User className="h-12 w-12 text-slate-400 mx-auto mb-3" />
            <strong className="text-slate-800 text-lg">Không thể tải thông tin hồ sơ</strong>
            <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">Vui lòng làm mới trang hoặc kiểm tra lại kết nối mạng của bạn.</p>
          </div>
        ) : (
          <>
            {/* Header Hero Banner */}
            <section className="relative overflow-hidden rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50/90 via-white to-cyan-50/70 p-8 sm:p-10 text-slate-900 shadow-sm">
              {/* Decorative Glow Accents */}
              <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-sky-200/30 blur-3xl pointer-events-none" />
              <div className="absolute right-1/4 -bottom-24 h-64 w-64 rounded-full bg-cyan-200/25 blur-2xl pointer-events-none" />

              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                  {/* Avatar Container */}
                  <div className="relative shrink-0">
                    <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-sky-500 to-cyan-600 text-3xl font-black text-white shadow-lg ring-4 ring-sky-100 overflow-hidden">
                      {staff?.avatarUrl ? (
                        <img src={staff.avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                      ) : (
                        initials
                      )}
                    </div>
                    <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-emerald-500 border-2 border-white shadow-md flex items-center justify-center" title="Tài khoản đang hoạt động">
                      <span className="h-2 w-2 rounded-full bg-white animate-ping" />
                    </div>
                  </div>

                  {/* Profile Metadata Header */}
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-100/80 px-3 py-0.5 text-xs font-bold text-sky-800 shadow-2xs">
                      <Sparkles className="h-3.5 w-3.5 text-sky-600" />
                      <span>Hồ sơ Bệnh viện Chuyên nghiệp</span>
                    </div>

                    <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">{displayName}</h1>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-100/80 px-3.5 py-1 text-xs font-bold text-sky-800">
                        <Briefcase className="h-3.5 w-3.5" />
                        {roleLabel}
                      </span>

                      {staff?.managedDepartment && (
                        <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-1 text-xs font-bold text-amber-800">
                          <Building2 className="h-3.5 w-3.5" />
                          Trưởng khoa {staff.managedDepartment.name}
                        </span>
                      )}

                      <span className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-1 text-xs font-bold ${status.tone}`}>
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        {status.text}
                      </span>

                      {staff?.employeeCode && (
                        <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-1 text-xs font-mono font-bold text-slate-700">
                          Mã NV: {staff.employeeCode}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick Action Navigation */}
                <div className="flex items-center gap-3 shrink-0 self-start md:self-center pt-2 md:pt-0">
                  <button
                    type="button"
                    onClick={() => navigate('/settings')}
                    className="flex items-center gap-2 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white border border-sky-500 px-5 py-3 text-xs font-bold transition-all shadow-md shadow-sky-600/20"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    <span>Cài đặt hệ thống</span>
                  </button>
                </div>
              </div>
            </section>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Khuôn mặt Face ID</span>
                  <strong className="text-sm font-black text-slate-900">
                    {account?.hasFace ? 'Đã xác minh' : 'Chưa đăng ký'}
                  </strong>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                  <Lock className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Bảo mật mật khẩu</span>
                  <strong className="text-sm font-black text-slate-900">Mã hóa an toàn</strong>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <Calendar className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Ngày gia nhập</span>
                  <strong className="text-sm font-black text-slate-900">{formatDate(account?.createdAt)}</strong>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Bảo vệ dữ liệu</span>
                  <strong className="text-sm font-black text-slate-900">Đạt chuẩn y tế</strong>
                </div>
              </div>
            </div>

            {/* Profile Grid Details */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Main Column */}
              <div className="lg:col-span-2 space-y-8">
                {/* Section: Account Information */}
                <section className="rounded-3xl border border-slate-200/80 bg-white p-7 shadow-sm space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                        <User className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-lg font-black text-slate-900">Thông tin tài khoản</h2>
                        <p className="text-xs text-slate-500 font-semibold">Tên truy cập và thuộc tính xác thực hệ thống</p>
                      </div>
                    </div>
                  </div>

                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                    <DetailField icon={User} label="Tên đăng nhập" value={account?.username} />
                    <DetailField icon={Mail} label="Email liên hệ" value={account?.email} />
                    <DetailField icon={Briefcase} label="Vai trò hệ thống" value={roleLabel} />
                    <DetailField icon={Smartphone} label="Xác thực khuôn mặt" value={account?.hasFace ? 'Đã đăng ký' : 'Chưa đăng ký'} />
                    <DetailField icon={Calendar} label="Ngày đăng ký khuôn mặt" value={formatDateTime(account?.faceEnrolledAt)} />
                    <DetailField icon={Calendar} label="Ngày khởi tạo tài khoản" value={formatDateTime(account?.createdAt)} />
                  </dl>
                </section>

                {/* Section: Staff & Clinical Information (If Staff or Doctor) */}
                {staff && (
                  <section className="rounded-3xl border border-slate-200/80 bg-white p-7 shadow-sm space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                          <Stethoscope className="h-5 w-5" />
                        </div>
                        <div>
                          <h2 className="text-lg font-black text-slate-900">Hồ sơ cá nhân & Chuyên môn</h2>
                          <p className="text-xs text-slate-500 font-semibold">Thông tin định danh nhân sự bệnh viện</p>
                        </div>
                      </div>
                    </div>

                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                      <DetailField icon={User} label="Họ và tên đầy đủ" value={staff.fullName} />
                      <DetailField icon={Phone} label="Số điện thoại" value={staff.phone} />
                      <DetailField icon={CreditCard} label="Số căn cước / CCCD" value={staff.citizenId} />
                      <DetailField icon={Calendar} label="Ngày sinh" value={formatDate(staff.birthDate)} />
                      <DetailField icon={Briefcase} label="Chức danh công tác" value={staff.position} />
                      <DetailField icon={Building2} label="Phòng ban trực thuộc" value={staff.department?.name} />
                    </dl>

                    {/* Doctor Clinical Specifics */}
                    {doctor && (
                      <div className="mt-6 pt-6 border-t border-slate-100 space-y-4">
                        <h3 className="text-xs font-extrabold uppercase tracking-wider text-sky-700 flex items-center gap-1.5">
                          <Award className="h-4 w-4" />
                          Chứng chỉ & Trình độ bác sĩ
                        </h3>

                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                          <DetailField icon={Stethoscope} label="Chuyên khoa khám" value={doctor.specialty} />
                          <DetailField icon={Award} label="Số chứng chỉ hành nghề" value={doctor.licenseNumber} />
                          <DetailField icon={Award} label="Trình độ học vấn" value={doctor.qualification} />
                          <DetailField icon={Calendar} label="Số năm kinh nghiệm" value={doctor.yearsExperience != null ? `${doctor.yearsExperience} năm` : null} />
                        </dl>
                      </div>
                    )}
                  </section>
                )}

                {/* Section: Admin Info (If Admin) */}
                {admin && (
                  <section className="rounded-3xl border border-slate-200/80 bg-white p-7 shadow-sm space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                          <ShieldCheck className="h-5 w-5" />
                        </div>
                        <div>
                          <h2 className="text-lg font-black text-slate-900">Thông tin quản trị viên (Admin)</h2>
                          <p className="text-xs text-slate-500 font-semibold">Thông tin địa chỉ ví và phương thức bảo mật</p>
                        </div>
                      </div>
                    </div>

                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                      <DetailField icon={User} label="Tên tài khoản Admin" value={admin.adminUserName} />
                      <DetailField icon={CreditCard} label="Địa chỉ ví bảo mật" value={shortenWallet(admin.walletAddress)} mono />
                      <DetailField icon={KeyRound} label="Bảo mật tài khoản" value={admin.hasRecoverySecret ? 'Đã kích hoạt' : 'Chưa kích hoạt'} />
                    </dl>
                  </section>
                )}
              </div>

              {/* Sidebar Column */}
              <div className="space-y-6">
                {/* Security Card */}
                <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                      <KeyRound className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Bảo mật tài khoản</h3>
                      <p className="text-xs text-slate-500 font-semibold">Cài đặt mật khẩu & truy cập</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    Mật khẩu của bạn được bảo vệ bằng mã hóa cao cấp. Hãy chắc chắn sử dụng mật khẩu mạnh.
                  </p>

                  {canChangePassword && (
                    <button
                      type="button"
                      onClick={() => setShowChangePassword(true)}
                      className="w-full rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 text-xs transition shadow-sm flex items-center justify-center gap-2"
                    >
                      <Lock className="h-4 w-4" />
                      <span>Thay đổi mật khẩu</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => navigate('/settings')}
                    className="w-full rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-3 text-xs transition flex items-center justify-center gap-2"
                  >
                    <SlidersHorizontal className="h-4 w-4 text-sky-600" />
                    <span>Mở trang Cài đặt</span>
                  </button>
                </div>

                {/* System Status Card */}
                <div className="rounded-3xl border border-cyan-100 bg-gradient-to-br from-cyan-50/50 to-sky-50/50 p-6 shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-cyan-600" />
                    <h3 className="text-sm font-black text-slate-900">Trạng thái an toàn hệ thống</h3>
                  </div>

                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    Tài khoản của bạn được bảo vệ an toàn qua các lớp kiểm tra định danh sinh trắc học và hệ thống mã hóa bảo mật.
                  </p>

                  <div className="pt-2 border-t border-cyan-100 flex items-center justify-between text-xs text-cyan-800 font-bold">
                    <span>Trạng thái: Hoạt động tốt</span>
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
    </DashboardLayout>
  );
}

function DetailField({ icon: Icon, label, value, mono = false }) {
  const display = value === null || value === undefined || value === '' ? 'Chưa cập nhật' : value;
  const isEmpty = display === 'Chưa cập nhật';
  return (
    <div className="flex items-start gap-3 min-w-0">
      {Icon && (
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
          <Icon className="h-3.5 w-3.5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</dt>
        <dd className={`mt-0.5 break-words text-sm font-bold ${isEmpty ? 'text-slate-400 italic font-normal' : 'text-slate-900'} ${mono ? 'font-mono' : ''}`}>
          {display}
        </dd>
      </div>
    </div>
  );
}

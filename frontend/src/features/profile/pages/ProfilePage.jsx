import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { useToast } from '../../../providers/ToastProvider';
import { profileService } from '../apis/profileService';
import { getRoleNav } from '../constants/roleNav';
import ChangePasswordModal from '../components/ChangePasswordModal';

const ROLE_LABELS = {
  ADMIN: 'Quản trị viên',
  RECEPTIONIST: 'Lễ tân',
  DOCTOR: 'Bác sĩ',
  LAB_MANAGER: 'Quản lý xét nghiệm',
  DEPT_SHARED: 'Tài khoản phòng máy',
};

const STATUS_LABELS = {
  ACTIVE: { text: 'Đang hoạt động', tone: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  INACTIVE: { text: 'Ngưng hoạt động', tone: 'bg-rose-50 text-rose-700 border-rose-100' },
  PENDING: { text: 'Chờ kích hoạt', tone: 'bg-amber-50 text-amber-700 border-amber-100' },
};

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('vi-VN') : 'Chưa cập nhật';
}

function formatDateTime(value) {
  return value
    ? new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
    : 'Chưa cập nhật';
}

function genderLabel(value) {
  if (value === 'MALE' || value === 'Nam') return 'Nam';
  if (value === 'FEMALE' || value === 'Nữ') return 'Nữ';
  return value || 'Chưa cập nhật';
}

function shortenWallet(address) {
  if (!address) return 'Chưa liên kết';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function ProfilePage() {
  const { user, logout } = useAuth();
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

  // Only password-based staff roles can change a password. Admins authenticate by
  // wallet + face and have no passwordHash, so the option is hidden for them.
  const canChangePassword = Boolean(account) && account.role !== 'ADMIN';

  const displayName = staff?.fullName || admin?.adminUserName || account?.username || user?.username || 'Người dùng';
  const roleLabel = ROLE_LABELS[account?.role || user?.role] || account?.role || user?.role;
  const status = STATUS_LABELS[account?.status] || { text: account?.status || 'N/A', tone: 'bg-slate-100 text-slate-600 border-slate-200' };
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
      <div className="max-w-5xl mx-auto space-y-6">
        {loading ? (
          <LoadingIndicator size="lg" label="Đang tải thông tin cá nhân..." />
        ) : !profile ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
            <strong className="text-slate-800">Không có dữ liệu</strong>
            <p className="mt-1 text-sm text-slate-500">Không tải được thông tin cá nhân của bạn.</p>
          </div>
        ) : (
          <>
            {/* Header / Hero */}
            <section className="relative overflow-hidden rounded-[28px] border border-indigo-100 bg-gradient-to-br from-white via-indigo-50 to-cyan-50 p-8 shadow-sm">
              <p className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.24em] mb-4">Hồ sơ cá nhân</p>
              <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-indigo-600 text-2xl font-black text-white shadow-lg shadow-indigo-200">
                  {staff?.avatarUrl ? (
                    <img src={staff.avatarUrl} alt={displayName} className="h-full w-full rounded-3xl object-cover" />
                  ) : (
                    initials
                  )}
                </div>
                <div className="min-w-0">
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">{displayName}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-indigo-100 bg-white px-3 py-1 text-xs font-black text-indigo-700">
                      {roleLabel}
                    </span>
                    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black ${status.tone}`}>
                      {status.text}
                    </span>
                    {staff?.employeeCode && (
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-600">
                        Mã NV: {staff.employeeCode}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Account info (common) */}
            <Card title="Thông tin tài khoản">
              <Field label="Tên đăng nhập" value={account.username} />
              <Field label="Email" value={account.email} />
              <Field label="Vai trò" value={roleLabel} />
              <Field label="Xác thực khuôn mặt" value={account.hasFace ? 'Đã đăng ký' : 'Chưa đăng ký'} />
              <Field label="Ngày đăng ký khuôn mặt" value={formatDateTime(account.faceEnrolledAt)} />
              <Field label="Ngày tạo tài khoản" value={formatDateTime(account.createdAt)} />
            </Card>

            {/* Personal info (staff / doctor / lab) */}
            {staff && (
              <Card title="Thông tin cá nhân">
                <Field label="Họ và tên" value={staff.fullName} />
                <Field label="Giới tính" value={genderLabel(staff.gender)} />
                <Field label="Ngày sinh" value={formatDate(staff.birthDate)} />
                <Field label="Số điện thoại" value={staff.phone} />
                <Field label="CCCD/CMND" value={staff.citizenId} />
                <Field label="Địa chỉ" value={staff.address} />
                <Field label="Chức vụ" value={staff.position} />
                <Field label="Phòng ban" value={staff.department?.name} />
                {staff.managedDepartment && (
                  <Field label="Phòng ban phụ trách" value={staff.managedDepartment.name} />
                )}
              </Card>
            )}

            {/* Clinical credentials (doctor only) */}
            {doctor && (
              <Card title="Thông tin chuyên môn">
                <Field label="Chuyên khoa" value={doctor.specialty} />
                <Field label="Số chứng chỉ hành nghề" value={doctor.licenseNumber} />
                <Field label="Trình độ" value={doctor.qualification} />
                <Field
                  label="Số năm kinh nghiệm"
                  value={doctor.yearsExperience != null ? `${doctor.yearsExperience} năm` : null}
                />
              </Card>
            )}

            {/* Admin info */}
            {admin && (
              <Card title="Thông tin quản trị">
                <Field label="Tên quản trị" value={admin.adminUserName} />
                <Field label="Địa chỉ ví" value={shortenWallet(admin.walletAddress)} mono={admin.hasWallet} />
                <Field label="Mã khôi phục (MFA)" value={admin.hasRecoverySecret ? 'Đã thiết lập' : 'Chưa thiết lập'} />
              </Card>
            )}

            {/* Security: password change for staff roles only */}
            {canChangePassword && (
              <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div>
                      <h3 className="text-lg font-black text-slate-950">Bảo mật</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Đổi mật khẩu đăng nhập của bạn. Nên dùng mật khẩu mạnh và không chia sẻ cho người khác.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowChangePassword(true)}
                    className="shrink-0 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-black text-white hover:bg-indigo-700"
                  >
                    Đổi mật khẩu
                  </button>
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
    </DashboardLayout>
  );
}

function Card({ title, children }) {
  return (
    <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-2">
        <h3 className="text-lg font-black text-slate-950">{title}</h3>
      </div>
      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

function Field({ label, value, mono = false }) {
  const display = value === null || value === undefined || value === '' ? 'Chưa cập nhật' : value;
  const isEmpty = display === 'Chưa cập nhật';
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className={`mt-1 break-words text-sm font-semibold ${isEmpty ? 'text-slate-400 italic' : 'text-slate-900'} ${mono ? 'font-mono' : ''}`}>
        {display}
      </dd>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  UsersRound,
  UserRoundCheck,
  UserRoundX,
  ShieldCheck,
  MoreVertical,
  ArrowUpRight,
  TrendingUp,
  Activity,
  Plus,
  FileText,
  Clock,
  Sparkles,
} from 'lucide-react';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { departmentService } from '../apis/departmentService';
import { staffService } from '../apis/staffService';
import { ADMIN_NAV_ITEMS, navigateAdmin } from '../constants/navigation';
import { useToast } from '../../../providers/ToastProvider';

const ROLE_LABEL = {
  RECEPTIONIST: 'Lễ tân',
  LAB_MANAGER: 'KTV cận lâm sàng',
  ADMIN: 'Quản trị viên',
  DOCTOR: 'Bác sĩ',
};

const DEPARTMENT_TYPE_LABEL = {
  EXAMINATION: 'Phòng khám',
  CLINICAL: 'Khoa lâm sàng',
  ADMINISTRATIVE: 'Hành chính',
  LABORATORY: 'Xét nghiệm',
  IMAGING: 'Chẩn đoán hình ảnh',
  PHARMACY: 'Nhà thuốc',
  OTHER: 'Khác',
};

function getItems(data) {
  return Array.isArray(data) ? data : data?.items || [];
}

function toPercent(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'NV';
  return parts.slice(-2).map((part) => part[0]).join('').toUpperCase();
}

export default function AdminPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [departments, setDepartments] = useState([]);
  const [staffs, setStaffs] = useState([]);
  const [loading, setLoading] = useState(true);

  const overview = useMemo(() => {
    const active = staffs.filter((s) => s.user?.status === 'ACTIVE').length;
    const inactive = staffs.filter((s) => s.user?.status === 'INACTIVE').length;
    const roleRows = Object.entries(
      staffs.reduce((acc, staff) => {
        const role = staff.user?.role || 'UNKNOWN';
        acc[role] = (acc[role] || 0) + 1;
        return acc;
      }, {})
    ).map(([role, count]) => ({ label: ROLE_LABEL[role] || role, value: count }));

    const departmentRows = departments
      .map((department) => ({
        label: department.name,
        hint: DEPARTMENT_TYPE_LABEL[department.type] || department.specialty || 'Phòng ban',
        value: staffs.filter((staff) => staff.departmentId === department.id).length,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return {
      totalDepartments: departments.length,
      totalStaffs: staffs.length,
      active,
      inactive,
      activeRate: toPercent(active, staffs.length),
      roleRows,
      departmentRows,
    };
  }, [departments, staffs]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [departmentRes, staffRes] = await Promise.all([
          departmentService.list({ limit: 100 }),
          staffService.search({ excludeRole: 'DOCTOR', limit: 100 }),
        ]);
        setDepartments(getItems(departmentRes.data));
        setStaffs(getItems(staffRes.data));
      } catch (err) {
        toast.error(err?.response?.data?.message || err.message || 'Không tải được thống kê');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <DashboardLayout
      user={user}
      navItems={ADMIN_NAV_ITEMS}
      activeItem="overview"
      onNavigate={(id) => navigateAdmin(navigate, id)}
      onLogout={logout}
    >
      <div className="mx-auto max-w-[1600px] space-y-7 pb-10">
        {/* Welcome Header Banner */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm">
          <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-sky-500/5 blur-3xl" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200/60">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Hệ thống hoạt động bình thường
                </span>
                <span className="text-xs font-bold text-slate-400">· Synchronized</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Xin chào, {user?.fullName || user?.username || 'Quản trị viên'}!
              </h1>
              <p className="text-sm font-medium text-slate-500">
                Tổng quan tình hình nhân sự, phòng ban và vận hành toàn hệ thống Bệnh viện KLTN.
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/admin/staff')}
                className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-sky-700 transition-all"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                Quản lý Nhân sự
              </button>
              <button
                type="button"
                onClick={() => navigate('/admin/departments')}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition-all border border-slate-200/80"
              >
                <Building2 className="h-4 w-4 text-slate-500" strokeWidth={2} />
                Khoa phòng
              </button>
              <button
                type="button"
                onClick={() => navigate('/admin/audit')}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition-all border border-slate-200/80"
              >
                <Activity className="h-4 w-4 text-slate-500" strokeWidth={2} />
                Audit Logs
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-20">
            <LoadingIndicator size="lg" label="Đang đồng bộ thống kê hệ thống..." />
          </div>
        ) : (
          <>
            {/* Stat Cards Grid */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Phòng ban"
                value={overview.totalDepartments}
                unit="chuyên môn"
                icon={Building2}
                tone="sky"
                trend="+12% so với tháng trước"
              />
              <StatCard
                label="Nhân sự"
                value={overview.totalStaffs}
                unit="nhân viên"
                icon={UsersRound}
                tone="indigo"
                trend="Phân bổ toàn hệ thống"
              />
              <StatCard
                label="Đang hoạt động"
                value={overview.active}
                unit="tài khoản"
                icon={UserRoundCheck}
                tone="emerald"
                trend={`${overview.activeRate}% Tỷ lệ khả dụng`}
              />
              <StatCard
                label="Ngưng hoạt động"
                value={overview.inactive}
                unit="tài khoản"
                icon={UserRoundX}
                tone="rose"
                trend={`${toPercent(overview.inactive, overview.totalStaffs)}% Cần kiểm tra`}
              />
            </section>

            {/* Middle Section: Donut Chart & Role Distribution */}
            <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
              <div className="xl:col-span-6">
                <Panel
                  title="Trạng thái tài khoản"
                  subtitle="Tỷ lệ hoạt động thực tế theo danh sách nhân sự"
                  icon={Activity}
                >
                  <div className="grid gap-6 md:grid-cols-[220px_1fr] md:items-center py-2">
                    <DonutChart active={overview.active} inactive={overview.inactive} />
                    <div className="space-y-4">
                      <StatusRow
                        label="Đang hoạt động"
                        value={overview.active}
                        percent={overview.activeRate}
                        tone="sky"
                      />
                      <StatusRow
                        label="Ngưng hoạt động"
                        value={overview.inactive}
                        percent={toPercent(overview.inactive, overview.totalStaffs)}
                        tone="rose"
                      />
                    </div>
                  </div>
                </Panel>
              </div>

              <div className="xl:col-span-6">
                <Panel
                  title="Cơ cấu nhân sự"
                  subtitle="Phân bổ nhân viên theo vai trò vận hành"
                  icon={ShieldCheck}
                >
                  <ProgressList rows={overview.roleRows} total={overview.totalStaffs} emptyText="Chưa có dữ liệu vai trò" />
                </Panel>
              </div>
            </section>

            {/* Bottom Section: Departments & Recent Staff */}
            <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
              <div className="xl:col-span-6">
                <Panel
                  title="Nhân sự theo phòng ban"
                  subtitle="Mật độ nhân sự tập trung tại các đơn vị"
                  icon={Building2}
                  action={
                    <button
                      type="button"
                      onClick={() => navigate('/admin/departments')}
                      className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-700 transition-colors"
                    >
                      Chi tiết khoa <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  }
                >
                  <DepartmentList rows={overview.departmentRows} />
                </Panel>
              </div>

              <div className="xl:col-span-6">
                <Panel
                  title="Nhân sự mới nhất"
                  subtitle="Danh sách hồ sơ mới cập nhật gần đây"
                  icon={UsersRound}
                  action={
                    <button
                      type="button"
                      onClick={() => navigate('/admin/staff')}
                      className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-700 transition-colors"
                    >
                      Xem tất cả <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  }
                >
                  <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
                    {staffs.slice(0, 4).map((staff) => (
                      <StaffMini key={staff.id} staff={staff} />
                    ))}
                    {!staffs.length && (
                      <Empty title="Chưa có nhân sự" desc="Hãy tạo hồ sơ nhân sự theo phòng ban để hiển thị." />
                    )}
                  </div>
                </Panel>
              </div>
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function StatCard({ label, value, unit, icon: Icon, tone, trend }) {
  const toneMap = {
    sky: {
      border: 'border-sky-200/80 hover:border-sky-300',
      badge: 'bg-sky-50 text-sky-600 border-sky-100',
      bar: 'bg-sky-500',
    },
    indigo: {
      border: 'border-indigo-200/80 hover:border-indigo-300',
      badge: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      bar: 'bg-indigo-500',
    },
    emerald: {
      border: 'border-emerald-200/80 hover:border-emerald-300',
      badge: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      bar: 'bg-emerald-500',
    },
    rose: {
      border: 'border-rose-200/80 hover:border-rose-300',
      badge: 'bg-rose-50 text-rose-600 border-rose-100',
      bar: 'bg-rose-500',
    },
  }[tone];

  return (
    <article
      className={`group relative overflow-hidden rounded-3xl border bg-white p-6 shadow-sm shadow-slate-900/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-md ${toneMap.border}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
          <div className="mt-4 flex items-baseline gap-2">
            <strong className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              {String(value).padStart(2, '0')}
            </strong>
            <span className="text-xs font-semibold text-slate-400">{unit}</span>
          </div>
          {trend && (
            <p className="mt-3 flex items-center gap-1 text-[11px] font-bold text-slate-500">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              {trend}
            </p>
          )}
        </div>

        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border shadow-xs ${toneMap.badge}`}>
          <Icon className="h-6 w-6" strokeWidth={2} />
        </div>
      </div>

      {/* Micro Progress Line at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100">
        <div className={`h-full ${toneMap.bar} w-3/4 rounded-r-full transition-all duration-500 group-hover:w-full`} />
      </div>
    </article>
  );
}

function DonutChart({ active, inactive }) {
  const total = active + inactive;
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const activeOffset = circumference * (1 - (total ? active / total : 0));

  return (
    <div className="relative mx-auto h-52 w-52 flex items-center justify-center">
      <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90" role="img" aria-label="Biểu đồ donut trạng thái tài khoản">
        <circle cx="80" cy="80" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="16" />
        <circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          stroke="#fecdd3"
          strokeWidth="16"
          strokeDasharray={circumference}
          strokeLinecap="round"
        />
        <circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          stroke="#0284c7"
          strokeWidth="16"
          strokeDasharray={circumference}
          strokeDashoffset={activeOffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <strong className="text-3xl font-extrabold text-slate-900 tracking-tight">{toPercent(active, total)}%</strong>
        <span className="text-xs font-semibold text-slate-400">Hoạt động</span>
      </div>
    </div>
  );
}

function StatusRow({ label, value, percent, tone }) {
  const isSky = tone === 'sky';
  const dotColor = isSky ? 'bg-sky-600' : 'bg-rose-500';
  const barColor = isSky ? 'bg-sky-600' : 'bg-rose-400';

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 transition-all hover:bg-white hover:shadow-xs">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-xs font-bold text-slate-700">
          <span className={`h-2.5 w-2.5 rounded-full ${dotColor}`} /> {label}
        </span>
        <span className="text-xs font-extrabold text-slate-900">{value} tài khoản</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200/60">
        <div className={`h-full rounded-full ${barColor} transition-all duration-500`} style={{ width: `${Math.max(4, percent)}%` }} />
      </div>
      <p className="mt-1.5 text-[11px] font-semibold text-slate-400">{percent}% trên tổng số hồ sơ</p>
    </div>
  );
}

function ProgressList({ rows, total, emptyText }) {
  if (!rows.length) return <Empty title={emptyText} desc="Dữ liệu sẽ xuất hiện khi có hồ sơ phù hợp." />;

  return (
    <div className="space-y-4 py-2">
      {rows.map((row, index) => {
        const percent = toPercent(row.value, total);
        const isFirst = index === 0;
        return (
          <div key={row.label} className="group rounded-2xl border border-slate-100 bg-slate-50/40 p-3.5 transition-all hover:bg-white hover:border-slate-200 hover:shadow-xs">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800 flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${isFirst ? 'bg-sky-600' : 'bg-slate-400'}`} />
                {row.label}
              </span>
              <span className="font-bold text-slate-500">
                {row.value} <span className="text-slate-400 font-normal">({percent}%)</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200/60">
              <div
                className={`h-full rounded-full transition-all duration-500 ${isFirst ? 'bg-sky-600' : 'bg-slate-500'}`}
                style={{ width: `${Math.max(6, percent)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DepartmentList({ rows }) {
  if (!rows.length) return <Empty title="Chưa có phòng ban" desc="Hãy tạo phòng ban để bắt đầu thống kê." />;

  return (
    <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
      {rows.map((row, index) => (
        <div
          key={row.label}
          className={`flex items-center justify-between gap-4 p-4 transition-all hover:bg-sky-50/30 ${
            row.value === 0 ? 'bg-slate-50/40' : 'bg-white'
          }`}
        >
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 border border-slate-200/60">
              <Building2 className="h-5 w-5 text-slate-500" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <strong className="block truncate text-sm font-bold text-slate-800">{row.label}</strong>
              <p className="text-xs font-medium text-slate-400 truncate">{row.hint}</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-base font-extrabold text-sky-700">{row.value}</span>
            <span className="block text-[10px] font-semibold text-slate-400">nhân sự</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Panel({ title, subtitle, icon: Icon, action, children }) {
  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-900/5 transition-all">
      <div className="mb-5 flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600 border border-sky-100">
              <Icon className="h-4.5 w-4.5" strokeWidth={2} />
            </div>
          )}
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs font-medium text-slate-400">{subtitle}</p>}
          </div>
        </div>
        {action && <div>{action}</div>}
      </div>
      {children}
    </section>
  );
}

function StaffMini({ staff }) {
  return (
    <div className="flex items-center justify-between gap-4 p-4 transition-all hover:bg-sky-50/40">
      <div className="flex min-w-0 items-center gap-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700 border border-sky-200/80">
          {initials(staff.fullName)}
        </div>
        <div className="min-w-0">
          <strong className="block truncate text-sm font-bold text-slate-800">{staff.fullName}</strong>
          <span className="text-xs font-medium text-slate-400 truncate block">
            {staff.department?.name || 'Chưa gán khoa'} · {ROLE_LABEL[staff.user?.role] || staff.user?.role}
          </span>
        </div>
      </div>
      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
        Hoạt động
      </span>
    </div>
  );
}

function Empty({ title, desc }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
      <strong className="text-sm font-bold text-slate-700">{title}</strong>
      <p className="mt-1 text-xs text-slate-400">{desc}</p>
    </div>
  );
}

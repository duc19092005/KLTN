import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Building2, Download, MoreVertical, ShieldCheck, UserRoundCheck, UserRoundX, UsersRound } from 'lucide-react';
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
};

const DEPARTMENT_TYPE_LABEL = {
  EXAMINATION: 'Chuyên khoa',
  ADMINISTRATIVE: 'Hành chính',
  LABORATORY: 'Cận lâm sàng',
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

    const departmentRows = departments.map((department) => ({
      label: department.name,
      hint: DEPARTMENT_TYPE_LABEL[department.type] || department.specialty || 'Phòng ban',
      value: staffs.filter((staff) => staff.departmentId === department.id).length,
    })).sort((a, b) => b.value - a.value).slice(0, 5);

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
    <DashboardLayout user={user} navItems={ADMIN_NAV_ITEMS} activeItem="overview" onNavigate={(id) => navigateAdmin(navigate, id)} onLogout={logout}>
      <div className="mx-auto max-w-7xl space-y-6">
        {loading ? <LoadingIndicator size="lg" label="Đang tải thống kê..." /> : (
          <>
            <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-cyan-700">
                  <Activity className="h-3.5 w-3.5" /> Hospital OS
                </p>
                <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950 md:text-3xl">Tổng quan vận hành</h1>
                <p className="mt-1 text-sm font-semibold text-slate-400">Thống kê phòng ban, nhân sự và trạng thái tài khoản trong ngày.</p>
              </div>
              <button className="inline-flex w-fit items-center gap-2 rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-black text-white shadow-sm shadow-cyan-600/20 transition hover:bg-cyan-700">
                <Download className="h-4 w-4" /> Xuất báo cáo
              </button>
            </header>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Phòng ban" value={overview.totalDepartments} unit="chuyên môn" icon={Building2} tone="cyan" />
              <StatCard label="Nhân sự" value={overview.totalStaffs} unit="nhân viên" icon={UsersRound} tone="slate" />
              <StatCard label="Đang hoạt động" value={overview.active} unit="tài khoản" icon={UserRoundCheck} tone="emerald" />
              <StatCard label="Ngưng hoạt động" value={overview.inactive} unit="tài khoản" icon={UserRoundX} tone="rose" />
            </section>

            <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <Panel title="Trạng thái tài khoản" subtitle="Tỷ lệ hoạt động theo tài khoản nhân sự">
                <div className="grid gap-5 md:grid-cols-[230px_1fr] md:items-center">
                  <DonutChart active={overview.active} inactive={overview.inactive} />
                  <div className="space-y-3">
                    <StatusRow label="Đang hoạt động" value={overview.active} percent={overview.activeRate} tone="cyan" />
                    <StatusRow label="Ngưng hoạt động" value={overview.inactive} percent={toPercent(overview.inactive, overview.totalStaffs)} tone="rose" />
                  </div>
                </div>
              </Panel>

              <Panel title="Cơ cấu nhân sự" subtitle="Phân bổ theo vai trò vận hành">
                <ProgressList rows={overview.roleRows} total={overview.totalStaffs} emptyText="Chưa có dữ liệu vai trò" />
              </Panel>
            </section>

            <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <Panel title="Nhân sự theo phòng ban" subtitle="Mật độ nhân sự ở từng đơn vị" action={<MoreVertical className="h-4 w-4" />}>
                <DepartmentList rows={overview.departmentRows} />
              </Panel>

              <Panel title="Nhân sự mới nhất" subtitle="Hồ sơ được tạo gần đây" action="Xem tất cả" onAction={() => navigate('/admin/staff')}>
                <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
                  {staffs.slice(0, 4).map((staff) => <StaffMini key={staff.id} staff={staff} />)}
                  {!staffs.length && <Empty title="Chưa có nhân sự" desc="Hãy tạo hồ sơ nhân sự theo phòng ban." />}
                </div>
              </Panel>
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function StatCard({ label, value, unit, icon: Icon, tone }) {
  const toneMap = {
    cyan: { border: 'border-t-cyan-500', icon: 'bg-cyan-50 text-cyan-600 ring-cyan-100' },
    slate: { border: 'border-t-slate-300', icon: 'bg-slate-50 text-slate-500 ring-slate-100' },
    emerald: { border: 'border-t-emerald-400', icon: 'bg-emerald-50 text-emerald-600 ring-emerald-100' },
    rose: { border: 'border-t-rose-300', icon: 'bg-rose-50 text-rose-500 ring-rose-100' },
  }[tone];

  return (
    <article className={`group relative overflow-hidden rounded-3xl border border-slate-100 ${toneMap.border} border-t-2 bg-white p-5 shadow-sm shadow-slate-900/5 transition hover:-translate-y-0.5 hover:shadow-md`}>
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-slate-50" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">{label}</p>
          <div className="mt-5 flex items-end gap-2">
            <strong className="text-4xl font-black leading-none tracking-tight text-slate-800">{String(value).padStart(2, '0')}</strong>
            <span className="pb-1 text-sm font-bold text-slate-400">{unit}</span>
          </div>
        </div>
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ring-1 ${toneMap.icon}`}>
          <Icon className="h-5 w-5" strokeWidth={2.5} />
        </span>
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
    <div className="relative mx-auto h-56 w-56">
      <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90" role="img" aria-label="Biểu đồ donut trạng thái tài khoản">
        <circle cx="80" cy="80" r={radius} fill="none" stroke="#eef2f7" strokeWidth="18" />
        <circle cx="80" cy="80" r={radius} fill="none" stroke="#fecdd3" strokeWidth="18" strokeDasharray={circumference} strokeLinecap="round" />
        <circle cx="80" cy="80" r={radius} fill="none" stroke="#0891b2" strokeWidth="18" strokeDasharray={circumference} strokeDashoffset={activeOffset} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <strong className="block text-4xl font-black text-slate-800">{toPercent(active, total)}%</strong>
          <span className="text-sm font-bold text-slate-400">Hoạt động</span>
        </div>
      </div>
    </div>
  );
}

function StatusRow({ label, value, percent, tone }) {
  const color = tone === 'cyan' ? 'bg-cyan-600' : 'bg-rose-300';
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-sm font-black text-slate-600">
          <span className={`h-2.5 w-2.5 rounded-full ${color}`} /> {label}
        </span>
        <span className="text-sm font-black text-slate-700">{value}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-white">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(4, percent)}%` }} />
      </div>
      <p className="mt-2 text-xs font-semibold text-slate-400">{percent}% tổng hồ sơ</p>
    </div>
  );
}

function ProgressList({ rows, total, emptyText }) {
  if (!rows.length) return <Empty title={emptyText} desc="Dữ liệu sẽ xuất hiện khi có hồ sơ phù hợp." />;

  return (
    <div className="space-y-5 py-2">
      {rows.map((row, index) => {
        const percent = toPercent(row.value, total);
        return (
          <div key={row.label}>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-black text-slate-600">{row.label}</span>
              <span className="font-bold text-slate-400">{row.value} ({percent}%)</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className={index === 0 ? 'h-full rounded-full bg-cyan-600' : 'h-full rounded-full bg-slate-400'}
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
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
      {rows.map((row, index) => (
        <div key={row.label} className={`flex items-center justify-between gap-4 border-b border-slate-100 p-4 last:border-b-0 ${row.value === 0 ? 'opacity-45' : ''}`}>
          <div className="flex min-w-0 items-center gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-50 text-slate-400 ring-1 ring-slate-100">
              {index === 0 ? <Building2 className="h-5 w-5" /> : index === 1 ? <UsersRound className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <strong className="block truncate text-sm font-black text-slate-700">{row.label}</strong>
              <p className="text-xs font-semibold text-slate-400">{row.hint}</p>
            </div>
          </div>
          <span className="text-xl font-black text-cyan-700">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function Panel({ title, subtitle, action, onAction, children }) {
  return (
    <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm shadow-slate-900/5">
      <div className="mb-5 flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-xl font-black text-slate-800">{title}</h2>
          {subtitle && <p className="mt-1 text-sm font-semibold text-slate-400">{subtitle}</p>}
        </div>
        {action && <button onClick={onAction} className="rounded-xl px-2 py-1 text-sm font-black text-cyan-600 hover:bg-cyan-50">{action}</button>}
      </div>
      {children}
    </section>
  );
}

function StaffMini({ staff }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 p-4 transition last:border-b-0 hover:bg-cyan-50/40">
      <div className="flex min-w-0 items-center gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-cyan-50 text-sm font-black text-cyan-700">{initials(staff.fullName)}</div>
        <div className="min-w-0">
          <strong className="block truncate text-sm font-black text-slate-700">{staff.fullName}</strong>
          <span className="text-xs font-semibold text-slate-400">{staff.department?.name || 'Chưa gán phòng ban'} · {ROLE_LABEL[staff.user?.role] || staff.user?.role}</span>
        </div>
      </div>
      <span className="rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-600">Mới</span>
    </div>
  );
}

function Empty({ title, desc }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center"><strong className="text-slate-800">{title}</strong><p className="mt-1 text-sm text-slate-500">{desc}</p></div>;
}

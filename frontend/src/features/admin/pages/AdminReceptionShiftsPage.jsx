import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import RejectReasonModal from '../../../shared/components/RejectReasonModal';
import { useAuth } from '../../../providers/AuthProvider';
import { useToast } from '../../../providers/ToastProvider';
import { shiftService as paraclinicalShiftService } from '../../paraclinical/apis/paraclinicalService';
import { receptionShiftService } from '../../receptionist/apis/receptionShiftService';
import { getRoleNav } from '../../profile/constants/roleNav';

const STATUS_META = {
  PENDING: { label: 'Chờ duyệt', dot: 'bg-amber-400', bg: 'bg-amber-50 border-amber-200 text-amber-800' },
  APPROVED: { label: 'Đã duyệt', dot: 'bg-emerald-500', bg: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  REJECTED: { label: 'Từ chối', dot: 'bg-red-400', bg: 'bg-red-50 border-red-200 text-red-700' },
};
const SHIFT_LABEL = { A: 'Ca A · 07:00 - 12:00', B: 'Ca B · 13:00 - 17:00' };
function unwrapList(res) { const p = res?.data?.data ?? res?.data; return Array.isArray(p) ? p : (Array.isArray(p?.items) ? p.items : []); }
function dateLabel(s) { return new Date(s.workDate || s.startTime).toLocaleDateString('vi-VN'); }
function deptLabel(s) { return s.department?.name || s.staff?.department?.name || s.departmentId?.slice(0, 8) || '—'; }

export default function AdminShiftsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const roleNav = getRoleNav(user?.role);
  const showReception = user?.role === 'ADMIN' || user?.role === 'RECEPTIONIST';
  const showParaclinical = user?.role === 'ADMIN' || user?.role === 'LAB_MANAGER';
  const [tab, setTab] = useState(showReception ? 'reception' : 'paraclinical');

  return <DashboardLayout user={user} navItems={roleNav.items} activeItem={user?.role === 'ADMIN' ? 'shifts' : 'approveShifts'} onNavigate={(id) => navigate(roleNav.routeFor(id))} onLogout={logout}>
    <div className="mx-auto max-w-7xl space-y-4">
      <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-600">Duyệt và quản lý ca trực</p>
        <h1 className="mt-1 text-2xl font-black text-slate-950">Phê duyệt ca làm việc</h1>
        <p className="mt-1 text-xs font-semibold text-slate-500">Quản lý ca A/B cho lễ tân và ca trực cận lâm sàng theo đúng phân quyền.</p>
      </section>
      <section className="flex gap-2 rounded-3xl border border-slate-100 bg-white p-2 shadow-sm">
        {showReception && <button onClick={() => setTab('reception')} className={`rounded-2xl px-4 py-2 text-xs font-black ${tab === 'reception' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/20' : 'text-slate-500 hover:bg-slate-50'}`}>Ca lễ tân</button>}
        {showParaclinical && <button onClick={() => setTab('paraclinical')} className={`rounded-2xl px-4 py-2 text-xs font-black ${tab === 'paraclinical' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:bg-slate-50'}`}>Ca cận lâm sàng</button>}
      </section>
      {tab === 'reception' && showReception && <ShiftTab kind="Lễ tân" service={receptionShiftService} toast={toast} />}
      {tab === 'paraclinical' && showParaclinical && <ShiftTab kind="Cận lâm sàng" service={paraclinicalShiftService} toast={toast} />}
    </div>
  </DashboardLayout>;
}

function ShiftTab({ kind, service, toast }) {
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [departmentShifts, setDepartmentShifts] = useState([]);
  const [rejectTarget, setRejectTarget] = useState(null);

  async function loadAll() {
    setLoading(true);
    try {
      const [pendingRes, depsRes] = await Promise.all([
        service.listPending(),
        service.availableDepartments ? service.availableDepartments() : Promise.resolve({ data: [] }),
      ]);
      const pendingList = unwrapList(pendingRes);
      const depList = unwrapList(depsRes);
      const map = new Map(depList.map((d) => [d.id, d]));
      pendingList.forEach((s) => { const d = s.department || s.staff?.department; if (d?.id) map.set(d.id, d); });
      const deps = [...map.values()];
      setPending(pendingList);
      setDepartments(deps);
      if (!selectedDepartment && deps[0]) setSelectedDepartment(deps[0].id);
    } catch (err) {
      toast.error(err.response?.data?.message || `Không tải được ca ${kind}.`);
    } finally { setLoading(false); }
  }
  async function loadDepartment() {
    if (!selectedDepartment) return;
    try { setDepartmentShifts(unwrapList(await service.listByDepartment(selectedDepartment))); } catch { setDepartmentShifts([]); }
  }
  useEffect(() => { loadAll(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [kind]);
  useEffect(() => { loadDepartment(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [selectedDepartment]);

  async function approve(id) { try { await service.approve(id); toast.success('Đã duyệt ca.'); await loadAll(); await loadDepartment(); } catch (err) { toast.error(err.response?.data?.message || 'Duyệt thất bại.'); } }
  async function confirmReject(reason) { try { await service.reject(rejectTarget.id, reason); toast.success('Đã từ chối ca.'); setRejectTarget(null); await loadAll(); await loadDepartment(); } catch (err) { toast.error(err.response?.data?.message || 'Từ chối thất bại.'); } }
  const shifts = useMemo(() => [...pending, ...departmentShifts.filter((s) => !pending.some((p) => p.id === s.id))], [pending, departmentShifts]);
  const summary = useMemo(() => shifts.reduce((acc, s) => ({ ...acc, [s.status]: (acc[s.status] || 0) + 1 }), { PENDING: 0, APPROVED: 0, REJECTED: 0 }), [shifts]);

  return <>
    <section className="grid grid-cols-3 gap-3">{Object.entries(STATUS_META).map(([status, meta]) => <div key={status} className={`rounded-2xl border p-4 ${meta.bg}`}><p className="text-[10px] font-black uppercase tracking-wide">{meta.label}</p><p className="mt-1 text-2xl font-black">{summary[status] || 0}</p></div>)}</section>
    <section className="flex flex-col gap-3 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
      <p className="text-xs font-black uppercase tracking-wider text-slate-500">Phòng ban</p>
      <select value={selectedDepartment} onChange={(e) => setSelectedDepartment(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-cyan-400">
        {departments.length === 0 && <option value="">-- Chưa có dữ liệu --</option>}
        {departments.map((d) => <option key={d.id} value={d.id}>{d.departmentCode} · {d.name}</option>)}
      </select>
    </section>
    {loading ? <LoadingIndicator size="lg" label="Đang tải dữ liệu..." /> : <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4"><h2 className="text-lg font-black text-slate-950">Ca {kind} ({shifts.length})</h2></div>
      {shifts.length === 0 ? <p className="p-8 text-center text-sm font-bold text-slate-400">Chưa có ca nào.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3 text-left">Nhân viên</th><th className="px-4 py-3 text-left">Phòng ban</th><th className="px-4 py-3 text-left">Ngày</th><th className="px-4 py-3 text-left">Ca</th><th className="px-4 py-3 text-left">Trạng thái</th><th className="px-4 py-3 text-right">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">{shifts.map((s) => { const meta = STATUS_META[s.status] || STATUS_META.PENDING; return <tr key={s.id} className="hover:bg-slate-50"><td className="px-4 py-3 font-bold text-slate-800">{s.staff?.fullName || 'N/A'}</td><td className="px-4 py-3 text-slate-600">{deptLabel(s)}</td><td className="px-4 py-3 text-slate-600">{dateLabel(s)}</td><td className="px-4 py-3 text-slate-600">{SHIFT_LABEL[s.shiftCode] || s.shiftCode}</td><td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-black ${meta.bg}`}><span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />{meta.label}</span></td><td className="px-4 py-3 text-right">{s.status === 'PENDING' ? <div className="inline-flex gap-2"><button onClick={() => approve(s.id)} className="rounded-lg bg-emerald-600 px-3 py-1 text-[11px] font-black text-white">Duyệt</button><button onClick={() => setRejectTarget(s)} className="rounded-lg border border-red-200 px-3 py-1 text-[11px] font-black text-red-600">Từ chối</button></div> : <span className="text-[11px] font-semibold text-slate-400">—</span>}</td></tr>; })}</tbody></table></div>}
    </section>}
    <RejectReasonModal open={Boolean(rejectTarget)} subtitle={rejectTarget?.staff?.fullName ? `Nhân viên: ${rejectTarget.staff.fullName}` : undefined} onConfirm={confirmReject} onClose={() => setRejectTarget(null)} />
  </>;
}

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { visitService } from '../apis/visitService';
import { patientService } from '../apis/patientService';
import { RECEPTIONIST_NAV_ITEMS, receptionistRouteFor } from '../constants/navigation';
import { getVisitStatus } from '../constants/visitStatus';
import { useToast } from '../../../providers/ToastProvider';

function getItems(data) { return Array.isArray(data) ? data : data?.items || []; }
function getVisitDepartmentName(visit) { return visit.department?.name || visit.department?.departmentCode || 'Chưa có phòng'; }

export default function ReceptionistDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [visits, setVisits] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadOverview() {
      setLoading(true);
      try {
        const [visitRes, patientRes] = await Promise.all([visitService.search({ limit: 100 }), patientService.search({ limit: 100 })]);
        if (!mounted) return;
        setVisits(getItems(visitRes.data));
        setPatients(getItems(patientRes.data));
      } catch (err) {
        if (mounted) toast.error(err.response?.data?.message || err.message || 'Không tải được dữ liệu');
      } finally { if (mounted) setLoading(false); }
    }
    loadOverview();
    return () => { mounted = false; };
  }, []);

  const analytics = useMemo(() => {
    const total = visits.length || 1;
    const statusRows = Object.entries(visits.reduce((acc, visit) => { acc[visit.status] = (acc[visit.status] || 0) + 1; return acc; }, {})).map(([status, count]) => ({ status, count, percent: Math.round((count / total) * 100), meta: getVisitStatus(status) }));
    const roomRows = Object.entries(visits.reduce((acc, visit) => { const room = getVisitDepartmentName(visit); acc[room] = (acc[room] || 0) + 1; return acc; }, {})).map(([label, count]) => ({ label, count, percent: Math.round((count / total) * 100) })).sort((a, b) => b.count - a.count).slice(0, 5);
    const today = new Date();
    const dayRows = Array.from({ length: 7 }).map((_, index) => { const date = new Date(today); date.setDate(today.getDate() - (6 - index)); const key = date.toISOString().slice(0, 10); const count = visits.filter((visit) => (visit.createdAt || visit.checkInAt || '').slice(0, 10) === key).length; return { label: date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }), count }; });
    const maxDay = Math.max(...dayRows.map((item) => item.count), 1);
    return { statusRows, roomRows, dayRows: dayRows.map((item) => ({ ...item, percent: Math.max(8, Math.round((item.count / maxDay) * 100)) })), totals: { patients: patients.length, visits: visits.length, waiting: visits.filter((v) => v.status === 'WAITING').length, processing: visits.filter((v) => ['IN_PROGRESS', 'WAITING_TEST_RESULT', 'WAITING_CONCLUSION'].includes(v.status)).length, completed: visits.filter((v) => v.status === 'COMPLETED').length, cancelled: visits.filter((v) => v.status === 'CANCELLED').length } };
  }, [patients.length, visits]);

  return (
    <DashboardLayout user={user} navItems={RECEPTIONIST_NAV_ITEMS} activeItem="overview" onNavigate={(id) => navigate(receptionistRouteFor(id))} onLogout={logout}>
      <div className="max-w-7xl mx-auto space-y-4">
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-600">Tổng quan</p><h1 className="mt-1 text-2xl font-black text-slate-950">Tiếp nhận</h1></div>
            <div className="flex gap-2"><button onClick={() => navigate('/receptionist/intake')} className="rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-black text-white hover:bg-cyan-700">+ Tiếp nhận</button><button onClick={() => navigate('/receptionist/queue')} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-50">Hàng đợi</button></div>
          </div>
        </section>
        {loading ? <LoadingIndicator size="lg" label="Đang tải..." /> : <>
          <section className="grid grid-cols-2 xl:grid-cols-5 gap-3">
            <StatCard label="Chờ khám" value={analytics.totals.waiting} />
            <StatCard label="Đang xử lý" value={analytics.totals.processing} />
            <StatCard label="Hoàn tất" value={analytics.totals.completed} />
            <StatCard label="Đã hủy" value={analytics.totals.cancelled} />
            <StatCard label="Hồ sơ" value={analytics.totals.patients} />
          </section>
          <section className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-5"><ChartCard title="Trạng thái"><StatusChart rows={analytics.statusRows} /></ChartCard><ChartCard title="7 ngày"><DailyChart rows={analytics.dayRows} /></ChartCard></section>
          <section className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-5"><ChartCard title="Top phòng"><RoomChart rows={analytics.roomRows} /></ChartCard><ChartCard title="Lối tắt"><div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><Shortcut title="Tiếp nhận" onClick={() => navigate('/receptionist/intake')} /><Shortcut title="Hàng đợi" onClick={() => navigate('/receptionist/queue')} /><Shortcut title="Hồ sơ" onClick={() => navigate('/receptionist/records')} /></div></ChartCard></section>
        </>}
      </div>
    </DashboardLayout>
  );
}
function StatCard({ label, value }) { return <article className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><p className="text-xs font-bold text-slate-500">{label}</p><strong className="mt-2 block text-3xl font-black text-slate-950">{String(value).padStart(2, '0')}</strong></article>; }
function ChartCard({ title, children }) { return <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><h2 className="text-lg font-black text-slate-950 mb-4">{title}</h2>{children}</section>; }
function StatusChart({ rows }) { if (!rows.length) return <EmptyChart />; return <div className="space-y-4">{rows.map((row) => <div key={row.status}><div className="mb-1.5 flex items-center justify-between text-xs"><span className="font-black text-slate-700">{row.meta.shortLabel || row.meta.label}</span><span className="font-black text-slate-500">{row.count} · {row.percent}%</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${row.meta.dot}`} style={{ width: `${row.percent}%` }} /></div></div>)}</div>; }
function DailyChart({ rows }) { return <div className="flex h-56 items-end justify-between gap-3 rounded-2xl bg-slate-50 p-4">{rows.map((row) => <div key={row.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><span className="text-xs font-black text-slate-700">{row.count}</span><div className="w-full max-w-8 rounded-t-xl bg-cyan-500" style={{ height: `${row.percent}%` }} /><span className="text-[11px] font-bold text-slate-500">{row.label}</span></div>)}</div>; }
function RoomChart({ rows }) { if (!rows.length) return <EmptyChart />; return <div className="space-y-3">{rows.map((row) => <div key={row.label} className="rounded-2xl bg-slate-50 p-3"><div className="mb-2 flex items-center justify-between text-xs"><span className="font-black text-slate-800">{row.label}</span><span className="font-black text-cyan-700">{row.count}</span></div><div className="h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-cyan-500" style={{ width: `${row.percent}%` }} /></div></div>)}</div>; }
function EmptyChart() { return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-bold text-slate-400">Chưa có dữ liệu</div>; }
function Shortcut({ title, onClick }) { return <button type="button" onClick={onClick} className="rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4 text-left font-black text-slate-950 hover:border-cyan-300 hover:bg-cyan-50">{title}</button>; }
function Alert({ tone, message }) { const cls = tone === 'error' ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-emerald-50 border-emerald-100 text-emerald-800'; return <div className={`rounded-2xl border p-4 text-sm font-bold ${cls}`}>{message}</div>; }

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { medicalOrderService } from '../../medical-order/apis/medicalOrderService';
import { LAB_MANAGER_NAV_ITEMS, labManagerRouteFor } from '../constants/navigation';
import { getMedicalOrderStatus } from '../constants/medicalOrderStatus';
import { useToast } from '../../../providers/ToastProvider';

function getItems(data) { return Array.isArray(data) ? data : data?.items || []; }

export default function LabManagerDashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const res = await medicalOrderService.list({});
        if (mounted) setOrders(getItems(res.data));
      } catch (err) {
        if (mounted) toast.error(err.response?.data?.message || 'Không tải được thống kê Lab');
      } finally { if (mounted) setLoading(false); }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const analytics = useMemo(() => {
    const total = orders.length || 1;
    const statuses = ['ORDERED', 'IN_PROGRESS', 'RESULT_READY', 'CANCELLED'].map((status) => {
      const count = orders.filter((o) => o.status === status).length;
      return { status, count, percent: Math.round((count / total) * 100), meta: getMedicalOrderStatus(status) };
    });
    const types = Object.entries(orders.reduce((acc, order) => {
      const key = order.orderType || 'Khác';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})).map(([label, count]) => ({ label, count, percent: Math.round((count / total) * 100) })).sort((a, b) => b.count - a.count).slice(0, 5);
    const todayKey = new Date().toISOString().slice(0, 10);
    return { statuses, types, today: orders.filter((o) => (o.orderedAt || o.createdAt || '').slice(0, 10) === todayKey).length };
  }, [orders]);

  return (
    <DashboardLayout user={user} navItems={LAB_MANAGER_NAV_ITEMS} activeItem="overview" onNavigate={(id) => navigate(labManagerRouteFor(id))} onLogout={logout}>
      <div className="max-w-7xl mx-auto space-y-4">
        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div><p className="text-[10px] uppercase tracking-[0.18em] font-black text-emerald-600">Lab Dashboard</p><h1 className="mt-1 text-2xl font-black text-slate-950">Tổng quan CLS</h1></div>
            <button onClick={() => navigate('/lab-manager/orders')} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white hover:bg-emerald-700">Xử lý phiếu</button>
          </div>
        </section>
        {loading ? <LoadingIndicator size="lg" label="Đang tải thống kê..." /> : <>
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
            <Kpi label="Hôm nay" value={analytics.today} />
            {analytics.statuses.map((row) => <Kpi key={row.status} label={row.meta.shortLabel} value={row.count} dot={row.meta.dot} />)}
          </section>
          <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <ChartCard title="Trạng thái phiếu"><StatusChart rows={analytics.statuses} /></ChartCard>
            <ChartCard title="Top chỉ định"><TypeChart rows={analytics.types} /></ChartCard>
          </section>
          <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Shortcut title="Phiếu CLS" desc="Nhận xử lý, upload kết quả." onClick={() => navigate('/lab-manager/orders')} />
            <Shortcut title="Kết quả" desc="Tra cứu file đã trả." onClick={() => navigate('/lab-manager/results')} />
          </section>
        </>}
      </div>
    </DashboardLayout>
  );
}
function Kpi({ label, value, dot }) { return <article className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm"><div className="flex items-center justify-between">{dot ? <span className={`h-2.5 w-2.5 rounded-full ${dot}`} /> : <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />}<strong className="text-2xl font-black text-slate-950">{value}</strong></div><p className="mt-2 text-xs font-black text-slate-600">{label}</p></article>; }
function ChartCard({ title, children }) { return <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm"><h2 className="mb-4 text-lg font-black text-slate-950">{title}</h2>{children}</section>; }
function StatusChart({ rows }) { return <div className="space-y-4">{rows.map((row) => <div key={row.status}><div className="mb-1.5 flex justify-between text-xs"><span className="font-black text-slate-700">{row.meta.label}</span><span className="font-black text-slate-500">{row.count} · {row.percent}%</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${row.meta.dot}`} style={{ width: `${Math.max(row.percent, row.count ? 6 : 0)}%` }} /></div></div>)}</div>; }
function TypeChart({ rows }) { if (!rows.length) return <Empty />; return <div className="space-y-3">{rows.map((row) => <div key={row.label} className="rounded-2xl bg-slate-50 p-3"><div className="mb-2 flex justify-between text-xs"><span className="font-black text-slate-800">{row.label}</span><span className="font-black text-emerald-700">{row.count}</span></div><div className="h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${row.percent}%` }} /></div></div>)}</div>; }
function Shortcut({ title, desc, onClick }) { return <button type="button" onClick={onClick} className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5 text-left hover:border-emerald-300"><strong className="block text-slate-950">{title}</strong><p className="mt-1 text-sm font-semibold text-slate-500">{desc}</p></button>; }
function Empty() { return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-bold text-slate-400">Chưa có dữ liệu</div>; }
function Alert({ tone, message }) { const cls = tone === 'error' ? 'bg-red-50 border-red-100 text-red-700' : 'bg-emerald-50 border-emerald-100 text-emerald-800'; return <div className={`rounded-2xl border p-4 text-sm font-bold ${cls}`}>{message}</div>; }

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { useToast } from '../../../providers/ToastProvider';
import { medicalOrderService } from '../../medical-order/apis/medicalOrderService';
import { PARACLINICAL_NAV_ITEMS, paraclinicalRouteFor } from '../constants/navigation';
import { getMedicalOrderStatus } from '../../lab-manager/constants/medicalOrderStatus';
import HandoverModal from '../components/HandoverModal';

function getItems(data) { return Array.isArray(data) ? data : data?.items || []; }

export default function ParaclinicalDashboardPage() {
  const { user, logout, updateSession } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showHandover, setShowHandover] = useState(false);

  // Paraclinical session info from JWT
  const staffName = user?.staffName || user?.username || 'N/A';
  const roomName = user?.roomName || 'N/A';
  const shiftId = user?.shiftId;

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const res = await medicalOrderService.list({});
        if (mounted) setOrders(getItems(res.data));
      } catch (err) {
        if (mounted) toast.error(err.response?.data?.message || 'Không tải được thống kê');
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
    const todayKey = new Date().toISOString().slice(0, 10);
    return { statuses, today: orders.filter((o) => (o.orderedAt || o.createdAt || '').slice(0, 10) === todayKey).length };
  }, [orders]);

  const handleHandoverComplete = (data) => {
    // Update session to reflect the new responsible person
    if (data?.toStaff) {
      updateSession({
        staffId: data.toStaffId,
        staffName: data.toStaff.fullName,
      });
    }
    setShowHandover(false);
  };

  return (
    <DashboardLayout user={user} navItems={PARACLINICAL_NAV_ITEMS} activeItem="overview" onNavigate={(id) => navigate(paraclinicalRouteFor(id))} onLogout={logout}>
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Current Staff Banner */}
        <section className="rounded-3xl border border-cyan-100 bg-gradient-to-r from-cyan-50 to-blue-50 p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-cyan-600 text-white">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] font-black text-cyan-600">Đang phụ trách</p>
                <h2 className="text-xl font-black text-slate-950">{staffName}</h2>
                <p className="text-xs font-bold text-slate-500 mt-0.5">Phòng: {roomName} {shiftId && <span className="text-cyan-600">· Ca đang hoạt động</span>}</p>
              </div>
            </div>
            <button
              onClick={() => setShowHandover(true)}
              className="rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 px-6 py-3 text-sm font-black text-white shadow-lg hover:shadow-xl hover:from-orange-600 hover:to-red-600 transition-all animate-pulse"
            >
              🔄 Bàn Giao Ca Trực
            </button>
          </div>
        </section>

        {/* Header */}
        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] font-black text-emerald-600">Dashboard CLS</p>
              <h1 className="mt-1 text-2xl font-black text-slate-950">Tổng quan cận lâm sàng</h1>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => navigate('/lab-manager/shifts')} className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-xs font-black text-cyan-700 hover:bg-cyan-100">📅 Lịch trực</button>
              <button onClick={() => navigate('/lab-manager/orders')} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white hover:bg-emerald-700">Xử lý phiếu</button>
            </div>
          </div>
        </section>

        {loading ? <LoadingIndicator size="lg" label="Đang tải thống kê..." /> : <>
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
            <Kpi label="Hôm nay" value={analytics.today} />
            {analytics.statuses.map((row) => <Kpi key={row.status} label={row.meta.shortLabel} value={row.count} dot={row.meta.dot} />)}
          </section>
          <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <ChartCard title="Trạng thái phiếu"><StatusChart rows={analytics.statuses} /></ChartCard>
          </section>
          <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Shortcut title="Lịch trực" desc="Xem và đăng ký ca trực." onClick={() => navigate('/lab-manager/shifts')} />
            <Shortcut title="Phiếu CLS" desc="Nhận xử lý, upload kết quả." onClick={() => navigate('/lab-manager/orders')} />
            <Shortcut title="Kết quả" desc="Tra cứu file đã trả." onClick={() => navigate('/lab-manager/results')} />
          </section>
        </>}
      </div>

      {/* Handover Modal */}
      <HandoverModal
        isOpen={showHandover}
        onClose={() => setShowHandover(false)}
        currentStaff={{ fullName: staffName }}
        clinicalRoomId={user?.clinicalRoomId}
        availableStaff={[]}
        onHandoverComplete={handleHandoverComplete}
      />
    </DashboardLayout>
  );
}

function Kpi({ label, value, dot }) { return <article className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm"><div className="flex items-center justify-between">{dot ? <span className={`h-2.5 w-2.5 rounded-full ${dot}`} /> : <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />}<strong className="text-2xl font-black text-slate-950">{value}</strong></div><p className="mt-2 text-xs font-black text-slate-600">{label}</p></article>; }
function ChartCard({ title, children }) { return <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm"><h2 className="mb-4 text-lg font-black text-slate-950">{title}</h2>{children}</section>; }
function StatusChart({ rows }) { return <div className="space-y-4">{rows.map((row) => <div key={row.status}><div className="mb-1.5 flex justify-between text-xs"><span className="font-black text-slate-700">{row.meta.label}</span><span className="font-black text-slate-500">{row.count} · {row.percent}%</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${row.meta.dot}`} style={{ width: `${Math.max(row.percent, row.count ? 6 : 0)}%` }} /></div></div>)}</div>; }
function Shortcut({ title, desc, onClick }) { return <button type="button" onClick={onClick} className="rounded-2xl border border-cyan-100 bg-cyan-50/60 p-5 text-left hover:border-cyan-300"><strong className="block text-slate-950">{title}</strong><p className="mt-1 text-sm font-semibold text-slate-500">{desc}</p></button>; }

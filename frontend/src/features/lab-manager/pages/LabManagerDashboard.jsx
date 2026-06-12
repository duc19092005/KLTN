import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { medicalOrderService } from '../../medical-order/apis/medicalOrderService';
import { LAB_MANAGER_NAV_ITEMS, labManagerRouteFor } from '../constants/navigation';
import { useToast } from '../../../providers/ToastProvider';

function getItems(data) { return Array.isArray(data) ? data : data?.items || []; }

export default function LabManagerDashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const isManager = user?.isManager || false;

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await medicalOrderService.list({});
      setOrders(getItems(res.data));
    } catch (err) {
      toast.error('Không tải được danh sách chỉ định cận lâm sàng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const analytics = useMemo(() => {
    const total = orders.length || 1;
    const ordered = orders.filter(o => o.status === 'ORDERED').length;
    const inProgress = orders.filter(o => o.status === 'IN_PROGRESS').length;
    const ready = orders.filter(o => o.status === 'RESULT_READY').length;

    return {
      total,
      ordered,
      inProgress,
      ready,
      orderedPercent: Math.round((ordered / total) * 100),
      inProgressPercent: Math.round((inProgress / total) * 100),
      readyPercent: Math.round((ready / total) * 100),
    };
  }, [orders]);

  return (
    <DashboardLayout user={user} navItems={LAB_MANAGER_NAV_ITEMS} activeItem="overview" onNavigate={(id) => navigate(labManagerRouteFor(id))} onLogout={logout}>
      <div className="max-w-7xl mx-auto space-y-4">
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] font-black text-cyan-600">
                {isManager && <span className="inline-block mr-2 rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 text-[9px]">Trưởng khoa</span>}
                Bảng điều khiển
              </p>
              <h1 className="mt-1 text-2xl font-black text-slate-950">Tổng quan xét nghiệm</h1>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={loadOrders} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-50">Làm mới</button>
              <button onClick={() => navigate('/lab-manager/orders')} className="rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-black text-white shadow-sm hover:bg-cyan-700">Vào phòng xét nghiệm</button>
            </div>
          </div>
        </section>

        {loading ? <LoadingIndicator size="lg" label="Đang tải thống kê..." /> : (
          <>
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Kpi label="Chờ tiếp nhận" value={analytics.ordered} percent={analytics.orderedPercent} tone="amber" />
              <Kpi label="Đang tiến hành" value={analytics.inProgress} percent={analytics.inProgressPercent} tone="cyan" />
              <Kpi label="Đã có kết quả" value={analytics.ready} percent={analytics.readyPercent} tone="emerald" />
            </section>
            <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Shortcut title="Phiếu chỉ định cận lâm sàng" desc="Danh sách chỉ định đang chờ kỹ thuật viên tiếp nhận và xử lý tệp." onClick={() => navigate('/lab-manager/orders')} />
              <Shortcut title="Lịch sử trả kết quả" desc="Xem và đối chiếu các kết quả cận lâm sàng đã gửi lên hệ thống." onClick={() => navigate('/lab-manager/results')} />
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function Kpi({ label, value, percent, tone }) {
  const colors = {
    emerald: { dot: 'bg-emerald-500', bg: 'bg-white border-slate-100', text: 'text-emerald-700' },
    amber:   { dot: 'bg-amber-400',   bg: 'bg-white border-slate-100', text: 'text-amber-700' },
    cyan:    { dot: 'bg-cyan-500',    bg: 'bg-white border-slate-100', text: 'text-cyan-700' },
  };
  const c = colors[tone] || colors.emerald;

  return (
    <article className={`rounded-2xl border p-4 shadow-sm ${c.bg}`}>
      <div className="flex items-center justify-between">
        <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
        <strong className="text-2xl font-black text-slate-950">{value}</strong>
      </div>
      <p className={`mt-2 text-xs font-black ${c.text}`}>{label}</p>
      <div className="mt-2 h-1.5 rounded-full bg-slate-200/60 overflow-hidden">
        <div className={`h-full rounded-full ${c.dot}`} style={{ width: `${Math.max(percent, value ? 6 : 0)}%` }} />
      </div>
      <span className="text-[10px] font-bold text-slate-400 mt-1 block">{percent}%</span>
    </article>
  );
}

function Shortcut({ title, desc, onClick }) {
  return (
    <button type="button" onClick={onClick} className="rounded-2xl border border-cyan-100 bg-cyan-50/60 p-5 text-left hover:border-cyan-300 transition-colors">
      <strong className="block text-slate-950">{title}</strong>
      <p className="mt-1 text-sm font-semibold text-slate-500">{desc}</p>
    </button>
  );
}

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
    } catch {
      toast.error('Không tải được danh sách chỉ định cận lâm sàng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const analytics = useMemo(() => {
    const totalOrders = orders.length;
    const denominator = totalOrders || 1;
    const ordered = orders.filter((order) => order.status === 'ORDERED').length;
    const inProgress = orders.filter((order) => order.status === 'IN_PROGRESS').length;
    const ready = orders.filter((order) => order.status === 'RESULT_READY').length;

    return {
      totalOrders,
      ordered,
      inProgress,
      ready,
      orderedPercent: Math.round((ordered / denominator) * 100),
      inProgressPercent: Math.round((inProgress / denominator) * 100),
      readyPercent: Math.round((ready / denominator) * 100),
    };
  }, [orders]);

  return (
    <DashboardLayout user={user} navItems={LAB_MANAGER_NAV_ITEMS} activeItem="overview" onNavigate={(id) => navigate(labManagerRouteFor(id))} onLogout={logout}>
      <div className="mx-auto max-w-[1600px] space-y-5 pb-12">
        {loading ? (
          <section className="rounded-2xl border border-slate-100 bg-white p-16 shadow-sm">
            <LoadingIndicator size="lg" label="Đang tải thống kê..." />
          </section>
        ) : (
          <>
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Kpi label="Chờ tiếp nhận" value={analytics.ordered} percent={analytics.orderedPercent} tone="amber" caption="Phiếu mới từ bác sĩ" />
              <Kpi label="Đang thực hiện" value={analytics.inProgress} percent={analytics.inProgressPercent} tone="cyan" caption="Đang xử lý kết quả" />
              <Kpi label="Đã có kết quả" value={analytics.ready} percent={analytics.readyPercent} tone="emerald" caption="Sẵn sàng cho bác sĩ" />
            </section>

            <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Shortcut title="Phiếu chỉ định cận lâm sàng" desc="Tiếp nhận phiếu mới, trả kết quả và quản lý danh sách đang xử lý." action="Mở danh sách phiếu" onClick={() => navigate('/lab-manager/orders')} />
              <Shortcut title="Lịch sử trả kết quả" desc="Xem lại kết quả đã gửi, kiểm tra nhận xét và tải tệp kết quả." action="Mở kho kết quả" onClick={() => navigate('/lab-manager/results')} />
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function Kpi({ label, value, percent, tone, caption }) {
  const colors = {
    emerald: { dot: 'bg-emerald-500', soft: 'bg-emerald-50 text-emerald-700 ring-emerald-100', bar: 'bg-emerald-500' },
    amber: { dot: 'bg-amber-400', soft: 'bg-amber-50 text-amber-700 ring-amber-100', bar: 'bg-amber-400' },
    cyan: { dot: 'bg-cyan-500', soft: 'bg-cyan-50 text-cyan-700 ring-cyan-100', bar: 'bg-cyan-500' },
  };
  const c = colors[tone] || colors.cyan;

  return (
    <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-colors hover:border-cyan-100 hover:bg-slate-50/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-slate-500">{label}</p>
          <p className="mt-1 text-[11px] font-semibold text-slate-400">{caption}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ${c.soft}`}>{percent}%</span>
      </div>
      <div className="mt-4 flex items-end justify-between">
        <strong className="text-3xl font-black text-slate-950">{value}</strong>
        <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${Math.max(percent, value ? 6 : 0)}%` }} />
      </div>
    </article>
  );
}

function Shortcut({ title, desc, action, onClick }) {
  return (
    <button type="button" onClick={onClick} className="group rounded-2xl border border-slate-100 bg-white p-5 text-left shadow-sm transition-colors hover:border-cyan-200 hover:bg-cyan-50/30">
      <div className="flex items-start justify-between gap-4">
        <div>
          <strong className="block text-sm font-black text-slate-950">{title}</strong>
          <p className="mt-1 text-sm font-semibold text-slate-500">{desc}</p>
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-50 text-cyan-700 ring-1 ring-slate-100 transition-colors group-hover:bg-cyan-600 group-hover:text-white">→</span>
      </div>
      <p className="mt-4 text-xs font-black text-cyan-700">{action}</p>
    </button>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { medicalOrderService } from '../../medical-order/apis/medicalOrderService';
import { LAB_MANAGER_NAV_ITEMS, labManagerRouteFor } from '../constants/navigation';
import { useToast } from '../../../providers/ToastProvider';
import { FlaskConical, Clock, Activity, CheckCircle2, ArrowRight, FileSpreadsheet, FileCheck2 } from 'lucide-react';

function getItems(data) { return Array.isArray(data) ? data : data?.items || []; }

export default function LabManagerDashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

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
      <div className="mx-auto max-w-[1600px] space-y-6 antialiased pb-12">
        {/* HERO BANNER */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-sky-50/80 blur-2xl pointer-events-none" />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-lg shadow-sky-600/25 shrink-0">
                <FlaskConical className="w-6 h-6" strokeWidth={2} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-sky-600 bg-sky-50 px-2.5 py-0.5 rounded-md border border-sky-100">
                    Phân hệ Kỹ thuật viên / Quản lý Xét nghiệm
                  </span>
                  <span className="text-xs font-semibold text-slate-400">• Tổng quan cận lâm sàng</span>
                </div>
                <h1 className="mt-1 text-2xl font-bold text-slate-900 tracking-tight">
                  Trung tâm Xét nghiệm & Chẩn đoán hình ảnh
                </h1>
              </div>
            </div>

            <button
              onClick={() => navigate('/lab-manager/orders')}
              className="w-fit rounded-xl bg-sky-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-sky-700 flex items-center gap-2"
            >
              <span>Xem danh sách phiếu chỉ định</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>

        {loading ? (
          <section className="rounded-3xl border border-slate-200/80 bg-white p-16 shadow-sm">
            <LoadingIndicator size="lg" label="Đang tải thống kê..." />
          </section>
        ) : (
          <>
            {/* KPI STAT CARDS */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Kpi label="Chờ tiếp nhận" value={analytics.ordered} percent={analytics.orderedPercent} tone="amber" icon={Clock} caption="Phiếu chỉ định mới từ bác sĩ" />
              <Kpi label="Đang thực hiện" value={analytics.inProgress} percent={analytics.inProgressPercent} tone="sky" icon={Activity} caption="Đang thực hiện & upload kết quả" />
              <Kpi label="Đã có kết quả" value={analytics.ready} percent={analytics.readyPercent} tone="emerald" icon={CheckCircle2} caption="Đã gửi kết quả cho bác sĩ" />
            </section>

            {/* QUICK SHORTCUTS */}
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Shortcut
                title="Phiếu chỉ định cận lâm sàng"
                desc="Tiếp nhận phiếu mới từ bác sĩ, cập nhật trạng thái và tải lên tệp kết quả."
                action="Mở danh sách phiếu"
                icon={FileSpreadsheet}
                onClick={() => navigate('/lab-manager/orders')}
              />
              <Shortcut
                title="Lịch sử trả kết quả"
                desc="Tra cứu các bản ghi kết quả đã gửi, kiểm tra nhận xét và các tệp đính kèm."
                action="Mở kho kết quả"
                icon={FileCheck2}
                onClick={() => navigate('/lab-manager/results')}
              />
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function Kpi({ label, value, percent, tone, icon: Icon, caption }) {
  const colors = {
    emerald: { dot: 'bg-emerald-500', soft: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: 'bg-emerald-500', iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
    amber: { dot: 'bg-amber-400', soft: 'bg-amber-50 text-amber-700 border-amber-200', bar: 'bg-amber-400', iconBg: 'bg-amber-50 text-amber-600 border-amber-100' },
    sky: { dot: 'bg-sky-500', soft: 'bg-sky-50 text-sky-700 border-sky-200', bar: 'bg-sky-500', iconBg: 'bg-sky-50 text-sky-600 border-sky-100' },
  };
  const c = colors[tone] || colors.sky;

  return (
    <article className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all hover:border-sky-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-slate-500">{label}</p>
          <p className="mt-0.5 text-[11px] font-medium text-slate-400">{caption}</p>
        </div>
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border shrink-0 ${c.iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="mt-4 flex items-end justify-between">
        <strong className="text-3xl font-bold text-slate-900">{value}</strong>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${c.soft}`}>{percent}%</span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full transition-all ${c.bar}`} style={{ width: `${Math.max(percent, value ? 8 : 0)}%` }} />
      </div>
    </article>
  );
}

function Shortcut({ title, desc, action, icon: Icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-3xl border border-slate-200/80 bg-white p-6 text-left shadow-sm transition-all hover:border-sky-300 hover:bg-sky-50/30 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center shrink-0 group-hover:bg-sky-600 group-hover:text-white transition-colors">
            <Icon className="w-6 h-6" strokeWidth={1.75} />
          </div>
          <div>
            <strong className="block text-base font-bold text-slate-900 group-hover:text-sky-700 transition-colors">{title}</strong>
            <p className="mt-1 text-xs font-medium text-slate-500 leading-relaxed">{desc}</p>
          </div>
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-50 text-sky-600 border border-slate-200 transition-all group-hover:bg-sky-600 group-hover:text-white group-hover:border-sky-600">
          <ArrowRight className="w-4 h-4" />
        </span>
      </div>
      <p className="mt-4 text-xs font-bold text-sky-600 group-hover:text-sky-700">{action} →</p>
    </button>
  );
}

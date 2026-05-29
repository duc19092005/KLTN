import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { medicalOrderService } from '../../medical-order/apis/medicalOrderService';
import { LAB_MANAGER_NAV_ITEMS, labManagerRouteFor } from '../constants/navigation';

function getItems(data) { return Array.isArray(data) ? data : data?.items || []; }

export default function LabManagerDashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true); setError('');
      try {
        const res = await medicalOrderService.list({});
        if (mounted) setOrders(getItems(res.data));
      } catch (err) {
        if (mounted) setError(err.response?.data?.message || 'Không tải được thống kê phòng Lab');
      } finally { if (mounted) setLoading(false); }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const stats = useMemo(() => [
    { label: 'Tổng chỉ định', value: orders.length, icon: '🧾', tone: 'emerald' },
    { label: 'Chờ xử lý', value: orders.filter((o) => o.status === 'ORDERED').length, icon: '⏳', tone: 'amber' },
    { label: 'Đang làm', value: orders.filter((o) => o.status === 'IN_PROGRESS').length, icon: '🔬', tone: 'blue' },
    { label: 'Có kết quả', value: orders.filter((o) => o.status === 'RESULT_READY').length, icon: '✅', tone: 'violet' },
  ], [orders]);

  return (
    <DashboardLayout user={user} navItems={LAB_MANAGER_NAV_ITEMS} activeItem="overview" onNavigate={(id) => navigate(labManagerRouteFor(id))} onLogout={logout}>
      <div className="max-w-7xl mx-auto space-y-6">
        <section className="relative overflow-hidden rounded-[32px] bg-slate-950 p-8 text-white shadow-2xl shadow-emerald-100">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.5),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.28),transparent_36%)]" />
          <div className="relative flex flex-col xl:flex-row xl:items-end justify-between gap-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] font-black text-emerald-200">Lab Overview</p>
              <h1 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight">Dashboard Quản lý xét nghiệm</h1>
              <p className="mt-3 max-w-3xl text-sm text-slate-300">Trang tổng quan chỉ hiển thị thống kê phòng Lab. Xử lý chỉ định và xem kết quả được tách thành page riêng.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
              <p className="text-[10px] uppercase tracking-wider text-emerald-200 font-black">Trạng thái phòng Lab</p>
              <strong className="mt-2 block text-sm">Hệ thống nhận MedicalOrder đang hoạt động</strong>
            </div>
          </div>
        </section>

        {error && <Alert tone="error" message={error} />}
        {loading ? <LoadingIndicator size="lg" label="Đang tải thống kê phòng Lab..." /> : (
          <>
            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {stats.map((item) => <StatCard key={item.label} {...item} />)}
            </section>
            <Card title="Lối tắt nghiệp vụ" subtitle="Mỗi chức năng mở sang một page riêng, không gộp vào Dashboard.">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Shortcut title="Chỉ định xét nghiệm" desc="Danh sách MedicalOrder cần tiếp nhận/xử lý." onClick={() => navigate('/lab-manager/orders')} />
                <Shortcut title="Kết quả đã trả" desc="Xem các hồ sơ MedicalResult đã upload." onClick={() => navigate('/lab-manager/results')} />
              </div>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function StatCard({ label, value, icon }) { return <article className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"><div className="flex justify-between"><div><p className="text-xs font-bold text-slate-500">{label}</p><strong className="block text-3xl font-black text-slate-950 mt-2">{String(value).padStart(2, '0')}</strong></div><span className="text-2xl">{icon}</span></div></article>; }
function Card({ title, subtitle, children }) { return <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm"><div className="mb-5"><h2 className="text-xl font-black text-slate-950">{title}</h2><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div>{children}</section>; }
function Shortcut({ title, desc, onClick }) { return <button type="button" onClick={onClick} className="group rounded-2xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50 p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-100"><strong className="block text-slate-950">{title}</strong><p className="mt-1 text-sm font-semibold text-slate-500">{desc}</p><span className="mt-4 inline-flex rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white transition-all group-hover:bg-emerald-700">Mở trang</span></button>; }
function Alert({ tone, message }) { const cls = tone === 'error' ? 'bg-red-50 border-red-100 text-red-700' : 'bg-emerald-50 border-emerald-100 text-emerald-800'; return <div className={`rounded-2xl border p-4 text-sm font-bold ${cls}`}>{message}</div>; }

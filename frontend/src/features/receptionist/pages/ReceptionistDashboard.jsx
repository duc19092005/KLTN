import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { visitService } from '../apis/visitService';
import { patientService } from '../apis/patientService';
import { RECEPTIONIST_NAV_ITEMS, receptionistRouteFor } from '../constants/navigation';

function getItems(data) { return Array.isArray(data) ? data : data?.items || []; }

export default function ReceptionistDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [visits, setVisits] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    async function loadOverview() {
      setLoading(true); setError('');
      try {
        const [visitRes, patientRes] = await Promise.all([
          visitService.search({ limit: 50 }),
          patientService.search({ limit: 50 }),
        ]);
        if (!mounted) return;
        setVisits(getItems(visitRes.data));
        setPatients(getItems(patientRes.data));
      } catch (err) {
        if (mounted) setError(err.response?.data?.message || err.message || 'Không tải được dữ liệu lễ tân');
      } finally { if (mounted) setLoading(false); }
    }
    loadOverview();
    return () => { mounted = false; };
  }, []);

  const stats = useMemo(() => [
    { label: 'Hồ sơ BN', value: patients.length, hint: 'Tổng hồ sơ gần đây', icon: '🧑‍⚕️' },
    { label: 'Chờ khám', value: visits.filter((v) => v.status === 'WAITING').length, hint: 'Đang xếp hàng', icon: '⏳' },
    { label: 'Đang xử lý', value: visits.filter((v) => ['IN_PROGRESS', 'WAITING_TEST_RESULT', 'WAITING_CONCLUSION'].includes(v.status)).length, hint: 'Đang trong quy trình', icon: '🩺' },
    { label: 'Hoàn tất', value: visits.filter((v) => v.status === 'COMPLETED').length, hint: 'Đã kết thúc khám', icon: '✅' },
  ], [patients, visits]);

  return (
    <DashboardLayout user={user} navItems={RECEPTIONIST_NAV_ITEMS} activeItem="overview" onNavigate={(id) => navigate(receptionistRouteFor(id))} onLogout={logout}>
      <div className="max-w-7xl mx-auto space-y-6">
        <section className="relative overflow-hidden rounded-[28px] border border-cyan-100 bg-gradient-to-br from-white via-cyan-50 to-blue-50 p-8 shadow-sm">
          <div className="absolute right-0 top-0 h-36 w-36 rounded-full bg-cyan-200/40 blur-3xl" />
          <div className="absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-blue-200/40 blur-3xl" />
          <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div>
              <p className="text-[11px] font-black text-cyan-600 uppercase tracking-[0.24em] mb-3">Reception Overview</p>
              <h1 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">Dashboard Lễ tân</h1>
              <p className="mt-3 max-w-3xl text-sm sm:text-base text-slate-600 leading-relaxed">Trang tổng quan chỉ hiển thị thống kê và điều hướng nhanh. Các nghiệp vụ tiếp nhận, hàng đợi và hồ sơ đã tách thành page riêng.</p>
            </div>
            <div className="rounded-2xl bg-white/80 border border-white shadow-sm p-4 min-w-[260px]">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Ca trực hiện tại</p>
              <div className="mt-2 flex items-center gap-3"><span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span></span><strong className="text-cyan-900">Quầy tiếp nhận đang hoạt động</strong></div>
            </div>
          </div>
        </section>

        {error && <Alert tone="error" message={error} />}
        {loading ? <LoadingIndicator size="lg" label="Đang tải thống kê lễ tân..." /> : (
          <>
            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {stats.map((item) => <StatCard key={item.label} {...item} />)}
            </section>
            <Card title="Lối tắt nghiệp vụ" subtitle="Mỗi chức năng mở sang một page riêng, không gộp trong dashboard.">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Shortcut title="Tiếp nhận" desc="Tìm/tạo bệnh nhân, tạo lượt khám." onClick={() => navigate('/receptionist/intake')} />
                <Shortcut title="Hàng đợi khám" desc="Theo dõi queue khám riêng." onClick={() => navigate('/receptionist/queue')} />
                <Shortcut title="Hồ sơ bệnh nhân" desc="Danh sách hồ sơ và lượt khám." onClick={() => navigate('/receptionist/records')} />
              </div>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function StatCard({ label, value, hint, icon }) { return <article className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"><div className="flex justify-between"><div><p className="text-xs font-bold text-slate-500">{label}</p><strong className="block text-3xl font-black text-slate-950 mt-2">{String(value).padStart(2, '0')}</strong></div><span className="text-2xl">{icon}</span></div><p className="mt-3 text-xs font-semibold text-cyan-600">{hint}</p></article>; }
function Card({ title, subtitle, children }) { return <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm"><div className="mb-5"><h2 className="text-xl font-black text-slate-950">{title}</h2><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div>{children}</section>; }
function Shortcut({ title, desc, onClick }) { return <button type="button" onClick={onClick} className="group rounded-2xl border border-cyan-100 bg-gradient-to-br from-white to-cyan-50 p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-lg hover:shadow-cyan-100"><strong className="block text-slate-950">{title}</strong><p className="mt-1 text-sm font-semibold text-slate-500">{desc}</p><span className="mt-4 inline-flex rounded-xl bg-cyan-600 px-3 py-2 text-xs font-black text-white transition-all group-hover:bg-cyan-700">Mở trang</span></button>; }
function Alert({ tone, message }) { const cls = tone === 'error' ? 'bg-red-50 border-red-100 text-red-700' : 'bg-emerald-50 border-emerald-100 text-emerald-800'; return <div className={`rounded-2xl border p-4 text-sm font-bold ${cls}`}>{message}</div>; }

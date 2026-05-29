import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { doctorVisitService } from '../apis/doctorVisitService';
import { DOCTOR_NAV_ITEMS, navigateDoctorSection } from '../constants/navigation';

const STATUS = {
  WAITING: { label: 'Chờ khám', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-400' },
  IN_PROGRESS: { label: 'Đang khám', color: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  WAITING_TEST_RESULT: { label: 'Chờ kết quả XN', color: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500' },
  WAITING_CONCLUSION: { label: 'Chờ kết luận', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' },
  COMPLETED: { label: 'Hoàn tất', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  CANCELLED: { label: 'Đã hủy', color: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
};

const FILTERS = [
  { id: '', label: 'Tất cả' },
  { id: 'WAITING', label: 'Chờ khám' },
  { id: 'IN_PROGRESS', label: 'Đang khám' },
  { id: 'WAITING_TEST_RESULT', label: 'Chờ XN' },
  { id: 'WAITING_CONCLUSION', label: 'Chờ kết luận' },
  { id: 'COMPLETED', label: 'Hoàn tất' },
];

const NEXT_ACTIONS = {
  WAITING: [{ status: 'IN_PROGRESS', label: 'Bắt đầu khám', icon: '▶', tone: 'blue' }],
  IN_PROGRESS: [
    { status: 'WAITING_TEST_RESULT', label: 'Chỉ định xét nghiệm', icon: '🧪', tone: 'purple' },
    { status: 'WAITING_CONCLUSION', label: 'Chờ kết luận', icon: '📝', tone: 'indigo' },
    { status: 'COMPLETED', label: 'Hoàn tất khám', icon: '✓', tone: 'emerald' },
  ],
  WAITING_TEST_RESULT: [{ status: 'WAITING_CONCLUSION', label: 'Đã có kết quả', icon: '📋', tone: 'indigo' }],
  WAITING_CONCLUSION: [{ status: 'COMPLETED', label: 'Hoàn tất hồ sơ', icon: '✓', tone: 'emerald' }],
};

function getItems(data) {
  return Array.isArray(data) ? data : data?.items || [];
}

function actionClass(tone) {
  const map = {
    blue: 'bg-blue-600 hover:bg-blue-700 shadow-blue-200',
    purple: 'bg-purple-600 hover:bg-purple-700 shadow-purple-200',
    indigo: 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200',
    emerald: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200',
  };
  return map[tone] || map.blue;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('vi-VN') : 'N/A';
}

function formatTime(value) {
  return value ? new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--';
}

export default function DoctorDashboard() {
  const { user, logout } = useAuth();
  const [visits, setVisits] = useState([]);
  const [activeVisit, setActiveVisit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState('');
  const [filter, setFilter] = useState('WAITING');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadVisits = async () => {
    setLoading(true);
    setError('');
    try {
      const params = filter ? { status: filter, limit: 50 } : { limit: 50 };
      const res = await doctorVisitService.list(params);
      const items = getItems(res.data);
      setVisits(items);
      setActiveVisit((current) => {
        if (!current) return items[0] || null;
        return items.find((visit) => visit.id === current.id) || items[0] || null;
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Không tải được danh sách lượt khám của bác sĩ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadVisits(); }, [filter]);

  const filteredVisits = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return visits;
    return visits.filter((visit) => [
      visit.visitCode,
      visit.patient?.patientCode,
      visit.patient?.fullName,
      visit.patient?.phone,
      visit.patient?.citizenId,
      visit.clinicalRoom?.roomName,
    ].filter(Boolean).some((field) => field.toLowerCase().includes(text)));
  }, [query, visits]);

  const stats = useMemo(() => [
    { label: 'Chờ khám', value: visits.filter((v) => v.status === 'WAITING').length, icon: '⏳', tone: 'amber' },
    { label: 'Đang xử lý', value: visits.filter((v) => ['IN_PROGRESS', 'WAITING_TEST_RESULT', 'WAITING_CONCLUSION'].includes(v.status)).length, icon: '🩺', tone: 'blue' },
    { label: 'Hoàn tất', value: visits.filter((v) => v.status === 'COMPLETED').length, icon: '✅', tone: 'emerald' },
    { label: 'Tổng lượt', value: visits.length, icon: '📊', tone: 'indigo' },
  ], [visits]);

  const updateStatus = async (visit, status) => {
    setUpdatingId(visit.id);
    setError('');
    setSuccess('');
    try {
      const res = await doctorVisitService.updateStatus(visit.id, status);
      setActiveVisit(res.data);
      setSuccess(`Đã cập nhật ${visit.visitCode} sang trạng thái ${STATUS[status]?.label || status}.`);
      await loadVisits();
      setTimeout(() => setSuccess(''), 4500);
    } catch (err) {
      setError(err.response?.data?.message || 'Không cập nhật được trạng thái lượt khám');
    } finally {
      setUpdatingId('');
    }
  };

  return (
    <DashboardLayout user={user} navItems={DOCTOR_NAV_ITEMS} activeItem="overview" onNavigate={navigateDoctorSection} onLogout={logout}>
      <div className="max-w-7xl mx-auto space-y-6">
        <section id="doctor-overview" className="relative overflow-hidden rounded-[32px] bg-slate-950 p-7 sm:p-8 text-white shadow-2xl shadow-blue-100 scroll-mt-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.5),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.28),transparent_36%)]" />
          <div className="absolute right-10 top-8 h-24 w-24 rounded-full border border-white/10 bg-white/5 blur-sm" />
          <div className="relative flex flex-col xl:flex-row xl:items-end justify-between gap-7">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-blue-200">Clinical Command Center</p>
              <h1 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight">Dashboard Bác sĩ</h1>
              <p className="mt-3 max-w-3xl text-sm sm:text-base leading-relaxed text-slate-300">
                Quản lý hàng đợi khám, mở phiếu bệnh nhân, cập nhật tiến trình lâm sàng và hoàn tất lượt khám trong một màn hình duy nhất.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-2 gap-3 min-w-0 xl:min-w-[390px]">
              {stats.map((item) => <StatCard key={item.label} {...item} />)}
            </div>
          </div>
        </section>

        {success && <Alert tone="success" message={success} />}
        {error && <Alert tone="error" message={error} />}

        <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <aside id="doctor-queue" className="xl:col-span-5 rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden scroll-mt-6">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] font-black text-blue-500">Patient Queue</p>
                <h2 className="text-xl font-black text-slate-950">Hàng đợi lượt khám</h2>
                <p className="text-sm text-slate-500">Chọn bệnh nhân để xem phiếu khám chi tiết.</p>
              </div>
              <button id="doctor-refresh-queue-button" onClick={loadVisits} className="h-11 px-4 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-black text-slate-700 hover:bg-white hover:border-blue-200 transition-all">
                {loading ? <LoadingIndicator size="sm" /> : 'Làm mới'}
              </button>
            </div>

            <div className="p-5 border-b border-slate-100 space-y-4">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
                <input
                  id="doctor-visit-search-input"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Tìm theo tên, mã BN, SĐT, CCCD..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-semibold outline-none transition-all focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {FILTERS.map((item) => (
                  <button key={item.id || 'ALL'} onClick={() => setFilter(item.id)} className={`px-3 py-2 rounded-xl text-xs font-black border whitespace-nowrap transition-all ${filter === item.id ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 space-y-3 max-h-[720px] overflow-y-auto">
              {loading && <LoadingIndicator size="lg" label="Đang tải hàng đợi khám..." />}
              {!loading && filteredVisits.length === 0 && <EmptyQueue />}
              {!loading && filteredVisits.map((visit) => (
                <VisitCard key={visit.id} visit={visit} active={activeVisit?.id === visit.id} onClick={() => setActiveVisit(visit)} />
              ))}
            </div>
          </aside>

          <main id="doctor-active-visit" className="xl:col-span-7 scroll-mt-6">
            {!activeVisit ? <EmptyDetail /> : (
              <VisitDetail visit={activeVisit} updating={updatingId === activeVisit.id} onStatus={(status) => updateStatus(activeVisit, status)} />
            )}
          </main>
        </section>

        <section id="doctor-history" className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm scroll-mt-6">
          <div className="mb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] font-black text-emerald-500">Clinical History</p>
              <h2 className="text-xl font-black text-slate-950">Lượt khám hoàn tất trong danh sách hiện tại</h2>
            </div>
            <span className="text-xs font-bold text-slate-500">Tự động cập nhật theo bộ lọc phía trên</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {visits.filter((visit) => visit.status === 'COMPLETED').slice(0, 6).map((visit) => <CompletedVisit key={visit.id} visit={visit} />)}
            {!visits.some((visit) => visit.status === 'COMPLETED') && <div className="md:col-span-2 xl:col-span-3"><Empty title="Chưa có lượt hoàn tất" desc="Khi bác sĩ hoàn tất khám, hồ sơ sẽ xuất hiện tại khu vực này." /></div>}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}

function StatCard({ label, value, icon }) {
  return <article className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur transition-all hover:bg-white/15"><div className="flex items-center justify-between gap-3"><p className="text-[10px] uppercase tracking-wider text-slate-300 font-black">{label}</p><span>{icon}</span></div><strong className="mt-2 block text-2xl font-black text-white">{String(value).padStart(2, '0')}</strong></article>;
}

function VisitCard({ visit, active, onClick }) {
  const st = STATUS[visit.status] || STATUS.WAITING;
  return <button onClick={onClick} className={`w-full text-left rounded-2xl border p-4 transition-all ${active ? 'border-blue-300 bg-blue-50 shadow-lg shadow-blue-100' : 'border-slate-100 bg-white hover:border-blue-200 hover:shadow-md hover:-translate-y-0.5'}`}><div className="flex justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{visit.visitCode} · {formatTime(visit.checkInAt)}</p><h3 className="mt-1 truncate font-black text-slate-950">{visit.patient?.fullName || 'Không rõ bệnh nhân'}</h3><p className="mt-1 text-xs font-semibold text-slate-500">{visit.patient?.patientCode} · {visit.patient?.phone || 'Chưa có SĐT'}</p></div><span className={`h-fit rounded-full border px-2.5 py-1 text-[10px] font-black whitespace-nowrap ${st.color}`}>{st.label}</span></div><div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3"><p className="text-xs font-black text-slate-700">{visit.clinicalRoom?.roomName || 'Chưa có phòng'}</p><p className="mt-0.5 line-clamp-2 text-[11px] font-medium text-slate-500">{visit.symptoms || 'Chưa ghi triệu chứng'}</p></div></button>;
}

function VisitDetail({ visit, updating, onStatus }) {
  const st = STATUS[visit.status] || STATUS.WAITING;
  const actions = NEXT_ACTIONS[visit.status] || [];
  return <div className="rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden"><div className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-emerald-50 p-6"><div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-blue-200/40 blur-3xl" /><div className="relative flex flex-col sm:flex-row sm:items-start justify-between gap-4"><div><p className="text-[11px] uppercase tracking-[0.22em] text-blue-500 font-black">Phiếu khám · {visit.visitCode}</p><h2 className="mt-2 text-2xl sm:text-3xl font-black text-slate-950">{visit.patient?.fullName || 'Không rõ bệnh nhân'}</h2><p className="mt-1 text-sm font-semibold text-slate-500">{visit.patient?.patientCode} · CCCD: {visit.patient?.citizenId || 'N/A'}</p></div><span className={`h-fit rounded-full border px-3 py-1.5 text-xs font-black ${st.color}`}><span className={`mr-2 inline-block h-2 w-2 rounded-full ${st.dot}`} />{st.label}</span></div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6"><Info label="Ngày sinh" value={formatDate(visit.patient?.birthDate)} /><Info label="Giới tính" value={visit.patient?.gender || 'N/A'} /><Info label="Số điện thoại" value={visit.patient?.phone || 'N/A'} /><Info label="Bảo hiểm" value={visit.patient?.insuranceNumber || 'N/A'} /><Info label="Phòng khám" value={`${visit.clinicalRoom?.roomName || 'N/A'} (${visit.clinicalRoom?.roomCode || '---'})`} /><Info label="Bác sĩ phụ trách" value={`BS. ${visit.doctor?.staffProfile?.fullName || 'N/A'}`} /><div className="md:col-span-2"><Info label="Triệu chứng ban đầu" value={visit.symptoms || 'Chưa ghi nhận'} large /></div><div className="md:col-span-2"><Info label="Địa chỉ" value={visit.patient?.address || 'N/A'} large /></div></div><div className="border-t border-slate-100 bg-slate-50 p-6"><p className="mb-3 text-[10px] uppercase tracking-[0.2em] font-black text-slate-400">Thao tác lâm sàng tiếp theo</p><div className="flex flex-wrap gap-3">{actions.length === 0 ? <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-500">Không còn thao tác tiếp theo cho trạng thái này.</p> : actions.map((action) => <button key={action.status} disabled={updating} onClick={() => onStatus(action.status)} className={`rounded-2xl px-4 py-3 text-sm font-black text-white shadow-lg transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0 ${actionClass(action.tone)}`}><span className="mr-2">{action.icon}</span>{updating ? 'Đang cập nhật...' : action.label}</button>)}</div></div></div>;
}

function Info({ label, value, large = false }) {
  return <div className={`rounded-2xl border border-slate-100 bg-slate-50 p-4 ${large ? 'min-h-[92px]' : ''}`}><p className="mb-1 text-[10px] uppercase tracking-wider text-slate-400 font-black">{label}</p><p className="text-sm font-bold leading-relaxed text-slate-800">{value}</p></div>;
}

function EmptyDetail() {
  return <div className="min-h-[560px] rounded-3xl border border-dashed border-slate-300 bg-white/80 flex flex-col items-center justify-center text-center p-8"><div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-50 text-3xl text-blue-600">🩺</div><h2 className="text-xl font-black text-slate-950">Chọn một lượt khám</h2><p className="mt-2 max-w-sm text-sm text-slate-500">Thông tin bệnh nhân, triệu chứng, phòng khám và nút cập nhật trạng thái sẽ hiển thị tại đây.</p></div>;
}

function EmptyQueue() {
  return <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center"><div className="text-4xl">🌿</div><h3 className="mt-3 font-black text-slate-800">Không có lượt khám phù hợp</h3><p className="mt-1 text-sm text-slate-500">Thử đổi bộ lọc hoặc làm mới hàng đợi.</p></div>;
}

function CompletedVisit({ visit }) {
  return <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4"><div className="flex items-start justify-between gap-3"><div><strong className="block text-slate-950">{visit.patient?.fullName || 'N/A'}</strong><span className="text-xs font-semibold text-slate-500">{visit.visitCode} · {formatDate(visit.completedAt)}</span></div><span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-emerald-700">DONE</span></div><p className="mt-3 text-xs font-bold text-emerald-700">{visit.clinicalRoom?.roomName || 'Phòng khám'}</p></div>;
}

function Alert({ tone, message }) {
  const cls = tone === 'error' ? 'bg-red-50 border-red-100 text-red-700' : 'bg-emerald-50 border-emerald-100 text-emerald-800';
  return <div className={`rounded-2xl border p-4 text-sm font-bold ${cls}`}>{message}</div>;
}

function Empty({ title, desc }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center"><strong className="text-slate-800">{title}</strong><p className="mt-1 text-sm text-slate-500">{desc}</p></div>;
}

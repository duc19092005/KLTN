import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { doctorVisitService } from '../apis/doctorVisitService';
import { DOCTOR_NAV_ITEMS, navigateDoctor } from '../constants/navigation';
import { useToast } from '../../../providers/ToastProvider';
import { Stethoscope, Clock, Users, CheckCircle2, ArrowRight } from 'lucide-react';

const ACTIVE_STATUSES = ['IN_PROGRESS', 'WAITING_TEST_RESULT', 'WAITING_CONCLUSION'];
const VISIT_STATUS_LABELS = {
  WAITING: 'Chờ khám',
  IN_PROGRESS: 'Đang khám',
  WAITING_TEST_RESULT: 'Chờ kết quả CLS',
  WAITING_CONCLUSION: 'Chờ kết luận',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
};

function getItems(data) {
  return Array.isArray(data) ? data : data?.items || [];
}
function getVisitDepartmentName(visit) { return visit.department?.name || visit.department?.departmentCode || 'Chưa có phòng'; }
function getVisitStaffName(visit) { return visit.staff?.fullName || visit.staff?.user?.username || ''; }

export default function DoctorDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadOverview = async () => {
    setLoading(true);
    try {
      const res = await doctorVisitService.list({ limit: 80 });
      setVisits(getItems(res.data));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không tải được dữ liệu tổng quan bác sĩ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOverview(); }, []);

  const stats = useMemo(() => [
    { label: 'Chờ khám', value: visits.filter((v) => v.status === 'WAITING').length, hint: 'Bệnh nhân đang chờ vào phòng', icon: Clock },
    { label: 'Đang xử lý', value: visits.filter((v) => ACTIVE_STATUSES.includes(v.status)).length, hint: 'Đang trong quy trình khám', icon: Stethoscope },
    { label: 'Chờ xét nghiệm', value: visits.filter((v) => v.status === 'WAITING_TEST_RESULT').length, hint: 'Đợi kết quả cận lâm sàng', icon: Users },
    { label: 'Hoàn tất', value: visits.filter((v) => v.status === 'COMPLETED').length, hint: 'Đã kết thúc lượt khám', icon: CheckCircle2 },
  ], [visits]);

  const activeVisits = visits.filter((v) => ACTIVE_STATUSES.includes(v.status)).slice(0, 5);
  const waitingVisits = visits.filter((v) => v.status === 'WAITING').slice(0, 5);

  return (
    <DashboardLayout user={user} navItems={DOCTOR_NAV_ITEMS} activeItem="overview" onNavigate={(id) => navigateDoctor(navigate, id)} onLogout={logout}>
      <div className="max-w-[1600px] mx-auto space-y-6 antialiased pb-12">
        {/* HERO BANNER */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-sky-50/80 blur-2xl pointer-events-none" />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-lg shadow-sky-600/25 shrink-0">
                <Stethoscope className="w-6 h-6" strokeWidth={2} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-sky-600 bg-sky-50 px-2.5 py-0.5 rounded-md border border-sky-100">
                    Phân hệ Bác sĩ
                  </span>
                  <span className="text-xs font-semibold text-slate-400">• Tổng quan ca khám</span>
                </div>
                <h1 className="mt-1 text-2xl font-bold text-slate-900 tracking-tight">
                  Bảng điều khiển Bác sĩ
                </h1>
              </div>
            </div>

            <button
              id="doctor-open-queue-button"
              onClick={() => navigate('/doctor/queue')}
              className="w-fit rounded-xl bg-sky-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-sky-700 flex items-center gap-2"
            >
              <span>Mở hàng đợi khám</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>

        {loading ? <LoadingIndicator size="lg" label="Đang tải tổng quan bác sĩ..." /> : (
          <>
            {/* STAT CARDS */}
            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {stats.map((item) => <StatCard key={item.label} {...item} />)}
            </section>

            {/* PANELS GRID */}
            <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <Panel title="Đang xử lý ca khám" subtitle="Các lượt khám chưa hoàn tất trong ca trực.">
                <div className="space-y-3">
                  {activeVisits.map((visit) => <VisitMini key={visit.id} visit={visit} />)}
                  {!activeVisits.length && <Empty title="Không có lượt đang xử lý" desc="Các ca đang khám hoặc chờ kết luận sẽ hiển thị tại đây." />}
                </div>
              </Panel>
              <Panel title="Sắp vào khám" subtitle="Danh sách chờ mới nhất. Thao tác chi tiết nằm ở trang Hàng đợi khám.">
                <div className="space-y-3">
                  {waitingVisits.map((visit) => <VisitMini key={visit.id} visit={visit} />)}
                  {!waitingVisits.length && <Empty title="Hàng đợi đang trống" desc="Chưa có bệnh nhân ở trạng thái chờ khám." />}
                </div>
              </Panel>
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function StatCard({ label, value, hint, icon: Icon }) {
  return (
    <article className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:border-sky-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-slate-500">{label}</p>
          <strong className="mt-2 block text-3xl font-bold text-slate-900">{String(value).padStart(2, '0')}</strong>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100 shrink-0">
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="mt-3 text-xs font-semibold text-sky-600">{hint}</p>
    </article>
  );
}

function Panel({ title, subtitle, children }) {
  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
      <div className="mb-5 border-b border-slate-100 pb-3">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        <p className="mt-0.5 text-xs font-medium text-slate-400">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function VisitMini({ visit }) {
  const staffName = getVisitStaffName(visit);
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 space-y-1.5 transition-all hover:bg-sky-50/30 hover:border-sky-200">
      <div className="flex items-center justify-between gap-3">
        <strong className="text-xs font-bold text-slate-900">{visit.patient?.fullName || 'N/A'}</strong>
        <span className="text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 rounded-full px-2.5 py-0.5">
          {VISIT_STATUS_LABELS[visit.status] || visit.status || 'Không rõ'}
        </span>
      </div>
      <p className="text-[11px] font-medium text-slate-500">Mã lượt: {visit.visitCode} • Mã BN: {visit.patient?.patientCode || 'N/A'}</p>
      <p className="text-xs font-semibold text-slate-700">{getVisitDepartmentName(visit)} • {staffName ? `BS. ${staffName}` : 'Chưa phân công bác sĩ'}</p>
    </div>
  );
}

function Empty({ title, desc }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
      <strong className="text-xs font-bold text-slate-700">{title}</strong>
      <p className="mt-1 text-[11px] font-medium text-slate-400">{desc}</p>
    </div>
  );
}

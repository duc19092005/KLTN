import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { doctorVisitService } from '../apis/doctorVisitService';
import { DOCTOR_NAV_ITEMS, navigateDoctor } from '../constants/navigation';
import { useToast } from '../../../providers/ToastProvider';

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
    { label: 'Chờ khám', value: visits.filter((v) => v.status === 'WAITING').length, hint: 'Bệnh nhân đang chờ vào phòng', tone: 'amber' },
    { label: 'Đang xử lý', value: visits.filter((v) => ACTIVE_STATUSES.includes(v.status)).length, hint: 'Đang trong quy trình khám', tone: 'cyan' },
    { label: 'Chờ xét nghiệm', value: visits.filter((v) => v.status === 'WAITING_TEST_RESULT').length, hint: 'Đợi kết quả cận lâm sàng', tone: 'cyan' },
    { label: 'Hoàn tất', value: visits.filter((v) => v.status === 'COMPLETED').length, hint: 'Đã kết thúc lượt khám', tone: 'emerald' },
  ], [visits]);

  const activeVisits = visits.filter((v) => ACTIVE_STATUSES.includes(v.status)).slice(0, 5);
  const waitingVisits = visits.filter((v) => v.status === 'WAITING').slice(0, 5);

  return (
    <DashboardLayout user={user} navItems={DOCTOR_NAV_ITEMS} activeItem="overview" onNavigate={(id) => navigateDoctor(navigate, id)} onLogout={logout}>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-end">
          <button
            id="doctor-open-queue-button"
            onClick={() => navigate('/doctor/queue')}
            className="w-fit rounded-xl bg-cyan-600 px-5 py-3 text-sm font-black text-white shadow-sm transition-colors hover:bg-cyan-700"
          >
            Mở hàng đợi khám
          </button>
        </div>

        {loading ? <LoadingIndicator size="lg" label="Đang tải tổng quan bác sĩ..." /> : (
          <>
            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {stats.map((item) => <StatCard key={item.label} {...item} />)}
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <Panel title="Đang xử lý" subtitle="Các lượt khám chưa hoàn tất trong ca trực.">
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

function StatCard({ label, value, hint }) {
  return <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-colors  hover:shadow-md"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-slate-500">{label}</p><strong className="mt-2 block text-3xl font-black text-slate-950">{String(value).padStart(2, '0')}</strong></div></div><p className="mt-3 text-xs font-semibold text-cyan-600">{hint}</p></article>;
}
function Panel({ title, subtitle, children }) { return <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"><div className="mb-5"><h2 className="text-xl font-black text-slate-950">{title}</h2><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div>{children}</section>; }
function VisitMini({ visit }) { const staffName = getVisitStaffName(visit); return <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><strong className="text-slate-950">{visit.patient?.fullName || 'N/A'}</strong><span className="text-[10px] font-black text-cyan-700 bg-cyan-50 border border-cyan-100 rounded-full px-2 py-1">{VISIT_STATUS_LABELS[visit.status] || visit.status || 'Không rõ'}</span></div><p className="mt-1 text-xs font-semibold text-slate-500">{visit.visitCode} · {visit.patient?.patientCode || 'Chưa có mã BN'}</p><p className="mt-2 text-sm text-slate-600">{getVisitDepartmentName(visit)} · {staffName ? `BS. ${staffName}` : 'Chưa phân công bác sĩ'}</p></div>; }
function Empty({ title, desc }) { return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center"><strong className="text-slate-800">{title}</strong><p className="mt-1 text-sm text-slate-500">{desc}</p></div>; }

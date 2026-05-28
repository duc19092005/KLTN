import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import PatientFinder from '../components/PatientFinder';
import CreateVisitForm from '../components/CreateVisitForm';
import VisitQueue from '../components/VisitQueue';
import { visitService } from '../apis/visitService';
import { patientService } from '../apis/patientService';
import { RECEPTIONIST_NAV_ITEMS, navigateReceptionistSection } from '../constants/navigation';

function getItems(data) {
  return Array.isArray(data) ? data : data?.items || [];
}

export default function ReceptionistDashboard() {
  const { user, logout } = useAuth();
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [refreshQueue, setRefreshQueue] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [visits, setVisits] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOverview = async () => {
    setLoading(true);
    setError('');
    try {
      const [visitRes, patientRes] = await Promise.all([
        visitService.search({ limit: 50 }),
        patientService.search({ limit: 50 }),
      ]);
      setVisits(getItems(visitRes.data));
      setPatients(getItems(patientRes.data));
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Không tải được dữ liệu lễ tân');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOverview(); }, [refreshQueue]);

  const stats = useMemo(() => [
    { label: 'Hồ sơ BN', value: patients.length, hint: 'Bệnh nhân gần đây', icon: '🧑‍⚕️' },
    { label: 'Chờ khám', value: visits.filter((v) => v.status === 'WAITING').length, hint: 'Đang xếp hàng', icon: '⏳' },
    { label: 'Đang xử lý', value: visits.filter((v) => ['IN_PROGRESS', 'WAITING_TEST_RESULT', 'WAITING_CONCLUSION'].includes(v.status)).length, hint: 'Đang trong quy trình', icon: '🩺' },
    { label: 'Hoàn tất', value: visits.filter((v) => v.status === 'COMPLETED').length, hint: 'Đã kết thúc khám', icon: '✅' },
  ], [patients, visits]);

  const handleVisitCreated = (visit) => {
    setStatusMsg(`Đã tạo thành công lượt khám ${visit.visitCode} cho bệnh nhân ${visit.patient?.fullName}`);
    setSelectedPatient(null);
    setRefreshQueue((prev) => prev + 1);
    navigateReceptionistSection('visit-queue');
    setTimeout(() => setStatusMsg(''), 5000);
  };

  return (
    <DashboardLayout user={user} navItems={RECEPTIONIST_NAV_ITEMS} activeItem="overview" onNavigate={navigateReceptionistSection} onLogout={logout}>
      <div className="max-w-7xl mx-auto space-y-6">
        <section id="receptionist-overview" className="relative overflow-hidden rounded-[28px] border border-cyan-100 bg-gradient-to-br from-white via-cyan-50 to-blue-50 p-8 shadow-sm scroll-mt-6">
          <div className="absolute right-0 top-0 h-36 w-36 rounded-full bg-cyan-200/40 blur-3xl" />
          <div className="absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-blue-200/40 blur-3xl" />
          <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div>
              <p className="text-[11px] font-black text-cyan-600 uppercase tracking-[0.24em] mb-3">Patient Intake Command Center</p>
              <h1 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">Dashboard Lễ tân</h1>
              <p className="mt-3 max-w-3xl text-sm sm:text-base text-slate-600 leading-relaxed">
                Trung tâm tiếp nhận bệnh nhân, tìm hồ sơ theo CCCD/SĐT, tạo lượt khám, điều phối phòng khám và theo dõi hàng đợi theo thời gian thực.
              </p>
            </div>
            <div className="rounded-2xl bg-white/80 border border-white shadow-sm p-4 min-w-[260px]">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Ca trực hiện tại</p>
              <div className="mt-2 flex items-center gap-3">
                <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span></span>
                <strong className="text-cyan-900">Quầy tiếp nhận đang hoạt động</strong>
              </div>
            </div>
          </div>
        </section>

        {statusMsg && <Alert tone="success" message={statusMsg} />}
        {error && <Alert tone="error" message={error} />}

        {loading ? <LoadingIndicator size="lg" label="Đang tải dữ liệu lễ tân..." /> : (
          <>
            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {stats.map((item) => <StatCard key={item.label} {...item} />)}
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <Card id="patient-intake" className="xl:col-span-2" title="Tiếp nhận bệnh nhân" subtitle="Flow chuẩn: tìm hồ sơ → tạo patient nếu chưa có → tạo Visit → gán phòng/bác sĩ.">
                {!selectedPatient ? <PatientFinder onPatientSelected={setSelectedPatient} /> : (
                  <CreateVisitForm patient={selectedPatient} onCancel={() => setSelectedPatient(null)} onVisitCreated={handleVisitCreated} />
                )}
              </Card>

              <div id="visit-queue" className="h-[720px] scroll-mt-6">
                <VisitQueue refreshTrigger={refreshQueue} />
              </div>
            </section>

            <section id="patient-records" className="grid grid-cols-1 xl:grid-cols-2 gap-6 scroll-mt-6">
              <Card title="Bệnh nhân gần đây" subtitle="Danh sách hồ sơ vừa được tạo/cập nhật.">
                <div className="space-y-3">
                  {patients.slice(0, 7).map((p) => <PatientMini key={p.id} patient={p} onSelect={setSelectedPatient} />)}
                  {!patients.length && <Empty title="Chưa có hồ sơ bệnh nhân" desc="Hãy tiếp nhận bệnh nhân đầu tiên để tạo dữ liệu." />}
                </div>
              </Card>

              <Card title="Lượt khám mới nhất" subtitle="Các lượt khám đang được điều phối trong ngày.">
                <div className="space-y-3">
                  {visits.slice(0, 7).map((v) => <VisitMini key={v.id} visit={v} />)}
                  {!visits.length && <Empty title="Chưa có lượt khám" desc="Sau khi tạo Visit, dữ liệu sẽ xuất hiện tại đây." />}
                </div>
              </Card>
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function StatCard({ label, value, hint, icon }) {
  return <article className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"><div className="flex justify-between"><div><p className="text-xs font-bold text-slate-500">{label}</p><strong className="block text-3xl font-black text-slate-950 mt-2">{String(value).padStart(2, '0')}</strong></div><span className="text-2xl">{icon}</span></div><p className="mt-3 text-xs font-semibold text-cyan-600">{hint}</p></article>;
}
function Card({ id, title, subtitle, className = '', children }) { return <section id={id} className={`rounded-3xl border border-slate-100 bg-white p-6 shadow-sm scroll-mt-6 ${className}`}><div className="mb-5"><h2 className="text-xl font-black text-slate-950">{title}</h2>{subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}</div>{children}</section>; }
function Alert({ tone, message }) { const cls = tone === 'error' ? 'bg-red-50 border-red-100 text-red-700' : 'bg-emerald-50 border-emerald-100 text-emerald-800'; return <div className={`rounded-2xl border p-4 text-sm font-bold ${cls}`}>{message}</div>; }
function Empty({ title, desc }) { return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center"><strong className="text-slate-800">{title}</strong><p className="mt-1 text-sm text-slate-500">{desc}</p></div>; }
function PatientMini({ patient, onSelect }) { return <button onClick={() => onSelect(patient)} className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left hover:bg-cyan-50 hover:border-cyan-200 transition-all"><strong className="block text-slate-950">{patient.fullName}</strong><span className="text-xs text-slate-500">{patient.patientCode} · {patient.phone || 'Chưa có SĐT'} · {patient.citizenId || 'Chưa có CCCD'}</span></button>; }
function VisitMini({ visit }) { return <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><strong className="text-slate-950">{visit.visitCode}</strong><span className="text-[10px] font-black text-cyan-700 bg-cyan-50 border border-cyan-100 rounded-full px-2 py-1">{visit.status}</span></div><p className="mt-1 text-sm text-slate-600">{visit.patient?.fullName || 'N/A'}</p><p className="text-xs text-slate-500">{visit.clinicalRoom?.roomName || 'Chưa có phòng'} · BS. {visit.doctor?.staffProfile?.fullName || 'N/A'}</p></div>; }

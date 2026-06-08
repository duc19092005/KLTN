import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { visitService } from '../apis/visitService';
import { patientService } from '../apis/patientService';
import { FRONTDESK_NAV_ITEMS, frontdeskRouteFor } from '../constants/frontdeskNavigation';
import { getVisitStatus } from '../constants/visitStatus';
import { useToast } from '../../../providers/ToastProvider';

function getItems(data) { return Array.isArray(data) ? data : data?.items || []; }
function getVisitDepartmentName(visit) { return visit.department?.name || visit.department?.departmentCode || 'Chưa có phòng'; }
function getVisitStaffName(visit) { return visit.staff?.fullName || visit.staff?.user?.username || 'N/A'; }
const PAGE_SIZE = 10;

export default function ReceptionistRecordsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [patients, setPatients] = useState([]);
  const [visits, setVisits] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const [patientRes, visitRes] = await Promise.all([patientService.search({ limit: 100 }), visitService.search({ limit: 100 })]);
        if (!mounted) return;
        setPatients(getItems(patientRes.data));
        setVisits(getItems(visitRes.data));
      } catch (err) {
        if (mounted) toast.error(err.response?.data?.message || 'Không tải được hồ sơ');
      } finally { if (mounted) setLoading(false); }
    }
    load();
    return () => { mounted = false; };
  }, []);

  useEffect(() => { setPage(1); }, [query]);

  const filteredPatients = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return patients;
    return patients.filter((patient) => [patient.fullName, patient.patientCode, patient.phone, patient.citizenId].filter(Boolean).some((value) => String(value).toLowerCase().includes(text)));
  }, [patients, query]);

  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / PAGE_SIZE));
  const pagedPatients = filteredPatients.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const visitsOf = (patient) => visits.filter((visit) => visit.patientId === patient.id || visit.patient?.id === patient.id);

  return (
    <DashboardLayout user={user} navItems={FRONTDESK_NAV_ITEMS} activeItem="patient-records" onNavigate={(id) => navigate(frontdeskRouteFor(id))} onLogout={logout}>
      <div className="mx-auto max-w-7xl space-y-4">
        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-600">Hồ sơ</p><h1 className="mt-1 text-2xl font-black text-slate-950">Bệnh nhân</h1></div>
            <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm BN, CCCD, SĐT..." className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold outline-none focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-50 sm:w-[360px]" /><button onClick={() => navigate('/receptionist/intake')} className="rounded-xl bg-cyan-600 px-4 py-3 text-xs font-black text-white hover:bg-cyan-700">+ Tiếp nhận</button></div>
          </div>
        </section>

        {loading ? <LoadingIndicator size="lg" label="Đang tải hồ sơ..." /> : <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="text-lg font-black text-slate-950">Danh sách bệnh nhân</h2><p className="mt-1 text-xs font-semibold text-slate-500">{filteredPatients.length}/{patients.length}</p></div></div>{pagedPatients.length ? <><div className="hidden overflow-x-auto lg:block"><table className="min-w-full text-left"><thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Bệnh nhân</th><th className="px-5 py-3">CCCD</th><th className="px-5 py-3">SĐT</th><th className="px-5 py-3">Lượt khám</th><th className="px-5 py-3">Gần nhất</th><th className="px-5 py-3 text-right">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">{pagedPatients.map((patient) => <PatientRow key={patient.id} patient={patient} visits={visitsOf(patient)} onOpen={() => setSelectedPatient(patient)} />)}</tbody></table></div><div className="space-y-3 p-4 lg:hidden">{pagedPatients.map((patient) => <PatientCard key={patient.id} patient={patient} visits={visitsOf(patient)} onOpen={() => setSelectedPatient(patient)} />)}</div><Pagination page={page} totalPages={totalPages} total={filteredPatients.length} onPrev={() => setPage((v) => Math.max(1, v - 1))} onNext={() => setPage((v) => Math.min(totalPages, v + 1))} /></> : <Empty title="Không có dữ liệu" />}</section>}
      </div>
      {selectedPatient && <PatientDetailModal patient={selectedPatient} visits={visitsOf(selectedPatient)} onClose={() => setSelectedPatient(null)} onCreateVisit={() => navigate('/receptionist/intake')} />}
    </DashboardLayout>
  );
}

function PatientRow({ patient, visits, onOpen }) { const latestVisit = visits[0]; const latestStatus = latestVisit ? getVisitStatus(latestVisit.status) : null; return <tr onClick={onOpen} className="cursor-pointer bg-white hover:bg-cyan-50/40"><td className="px-5 py-4"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-50 text-xs font-black text-cyan-700">{patient.fullName?.slice(0, 2).toUpperCase()}</div><div><p className="text-sm font-black text-slate-900">{patient.fullName}</p><p className="text-[11px] font-semibold text-slate-500">{patient.patientCode}</p></div></div></td><td className="px-5 py-4 text-xs font-bold text-slate-600">{patient.citizenId || '—'}</td><td className="px-5 py-4 text-xs font-bold text-slate-600">{patient.phone || '—'}</td><td className="px-5 py-4 text-xs font-black text-cyan-700">{visits.length}</td><td className="px-5 py-4">{latestStatus ? <StatusBadge st={latestStatus} /> : <span className="text-xs font-bold text-slate-400">Chưa có</span>}</td><td className="px-5 py-4 text-right"><button type="button" onClick={(e) => { e.stopPropagation(); onOpen(); }} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50">Chi tiết</button></td></tr>; }
function PatientCard({ patient, visits, onOpen }) { const latestVisit = visits[0]; const latestStatus = latestVisit ? getVisitStatus(latestVisit.status) : null; return <button type="button" onClick={onOpen} className="w-full rounded-2xl border border-slate-100 bg-white p-4 text-left hover:bg-cyan-50/40"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-black text-slate-900">{patient.fullName}</p><p className="text-xs font-semibold text-slate-500">{patient.patientCode} · {patient.phone || 'Chưa có SĐT'}</p></div>{latestStatus ? <StatusBadge st={latestStatus} /> : <span className="text-xs font-bold text-slate-400">{visits.length} lượt</span>}</div></button>; }

function PatientDetailModal({ patient, visits, onClose, onCreateVisit }) { const latestVisit = visits[0]; const latestStatus = latestVisit ? getVisitStatus(latestVisit.status) : null; useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = 'unset'; }; }, []); return <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"><div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} /><div className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"><div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5"><div className="flex items-center gap-4"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-cyan-600 text-base font-black text-white">{patient.fullName?.slice(0, 2).toUpperCase()}</div><div><div className="mb-1 flex flex-wrap items-center gap-2"><span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-mono font-black text-slate-700">{patient.patientCode}</span>{latestStatus && <StatusBadge st={latestStatus} />}</div><h2 className="text-2xl font-black text-slate-950">{patient.fullName}</h2></div></div><button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">×</button></div><div className="grid flex-1 gap-5 overflow-y-auto p-5 xl:grid-cols-[0.9fr_1.1fr]"><section><h3 className="mb-3 text-sm font-black text-slate-950">Thông tin</h3><dl className="divide-y divide-slate-100 rounded-2xl border border-slate-100">{[['Ngày sinh', patient.birthDate ? new Date(patient.birthDate).toLocaleDateString('vi-VN') : 'Chưa cập nhật'], ['Giới tính', patient.gender === 'MALE' ? 'Nam' : patient.gender === 'FEMALE' ? 'Nữ' : 'Khác'], ['CCCD', patient.citizenId || 'Chưa cập nhật'], ['SĐT', patient.phone || 'Chưa cập nhật'], ['BHYT', patient.insuranceNumber || 'Chưa cập nhật'], ['Khẩn cấp', patient.emergencyContact || 'Chưa cập nhật'], ['Địa chỉ', patient.address || 'Chưa cập nhật']].map(([label, value]) => <div key={label} className="grid grid-cols-[110px_1fr] gap-3 px-4 py-3 text-sm"><dt className="font-bold text-slate-500">{label}</dt><dd className="font-bold text-slate-900 break-words">{value}</dd></div>)}</dl><button onClick={onCreateVisit} className="mt-4 w-full rounded-xl bg-cyan-600 px-4 py-3 text-xs font-black text-white hover:bg-cyan-700">+ Tiếp nhận</button></section><section><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-black text-slate-950">Lịch sử</h3><span className="text-xs font-black text-cyan-700">{visits.length}</span></div><div className="overflow-hidden rounded-2xl border border-slate-100"><div className="divide-y divide-slate-100">{visits.map((visit) => <VisitRow key={visit.id} visit={visit} />)}{!visits.length && <Empty title="Chưa có lượt khám" compact />}</div></div></section></div></div></div>; }
function VisitRow({ visit }) { const st = getVisitStatus(visit.status); return <div className="grid grid-cols-1 gap-2 bg-white p-4 hover:bg-slate-50 md:grid-cols-[1fr_120px_120px] md:items-center"><div><strong className="text-sm font-black text-slate-950">{visit.visitCode}</strong><p className="mt-1 text-xs font-semibold text-slate-500">{getVisitDepartmentName(visit)} · BS. {getVisitStaffName(visit)}</p></div><StatusBadge st={st} /><span className="text-xs font-semibold text-slate-500 md:text-right">{visit.createdAt ? new Date(visit.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : 'N/A'}</span></div>; }
function StatusBadge({ st }) { return <span className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-[11px] font-black ${st.color}`}><span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${st.dot}`} />{st.shortLabel || st.label}</span>; }
function Pagination({ page, totalPages, total, onPrev, onNext }) { return <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs font-bold text-slate-500">Trang {page}/{totalPages} · {total} hồ sơ</p><div className="flex gap-2"><button onClick={onPrev} disabled={page <= 1} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black text-slate-600 disabled:opacity-40">Trước</button><button onClick={onNext} disabled={page >= totalPages} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black text-slate-600 disabled:opacity-40">Sau</button></div></div>; }
function Empty({ title, compact = false }) { return <div className={`text-center text-sm font-bold text-slate-400 ${compact ? 'p-6' : 'p-12'}`}>{title}</div>; }

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { visitService } from '../apis/visitService';
import { patientService } from '../apis/patientService';
import { RECEPTIONIST_NAV_ITEMS, receptionistRouteFor } from '../constants/navigation';
import { getVisitStatus } from '../constants/visitStatus';

function getItems(data) { return Array.isArray(data) ? data : data?.items || []; }

export default function ReceptionistRecordsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [visits, setVisits] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true); setError('');
      try {
        const [patientRes, visitRes] = await Promise.all([patientService.search({ limit: 100 }), visitService.search({ limit: 100 })]);
        if (!mounted) return;
        const patientItems = getItems(patientRes.data);
        setPatients(patientItems);
        setVisits(getItems(visitRes.data));
        if (!selectedPatientId && patientItems.length) setSelectedPatientId(patientItems[0].id);
      } catch (err) {
        if (mounted) setError(err.response?.data?.message || 'Không tải được hồ sơ bệnh nhân');
      } finally { if (mounted) setLoading(false); }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const filteredPatients = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return patients;
    return patients.filter((patient) => [patient.fullName, patient.patientCode, patient.phone, patient.citizenId].filter(Boolean).some((value) => String(value).toLowerCase().includes(text)));
  }, [patients, query]);

  const selectedPatient = patients.find((patient) => patient.id === selectedPatientId) || filteredPatients[0] || null;
  const patientVisits = useMemo(() => visits.filter((visit) => visit.patientId === selectedPatient?.id || visit.patient?.id === selectedPatient?.id), [selectedPatient?.id, visits]);
  const latestVisit = patientVisits[0];

  useEffect(() => {
    if (filteredPatients.length && !filteredPatients.some((patient) => patient.id === selectedPatientId)) {
      setSelectedPatientId(filteredPatients[0].id);
    }
  }, [filteredPatients, selectedPatientId]);

  return (
    <DashboardLayout user={user} navItems={RECEPTIONIST_NAV_ITEMS} activeItem="patient-records" onNavigate={(id) => navigate(receptionistRouteFor(id))} onLogout={logout}>
      <div className="max-w-7xl mx-auto space-y-5">
        <section className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Hồ sơ bệnh nhân</p>
              <h1 className="mt-1 text-2xl font-black text-slate-950">Tra cứu & lịch sử khám</h1>
              <p className="mt-1 text-xs font-semibold text-slate-500">Chọn bệnh nhân bên trái để xem thông tin và các lượt khám liên quan.</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm tên, mã BN, CCCD, SĐT..." className="w-full sm:w-[360px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50" />
              <button onClick={() => navigate('/receptionist/intake')} className="rounded-xl bg-blue-600 px-4 py-3 text-xs font-black text-white hover:bg-blue-700">Tiếp nhận mới</button>
            </div>
          </div>
        </section>

        {error && <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
        {loading ? <LoadingIndicator size="lg" label="Đang tải hồ sơ..." /> : (
          <section className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-5">
            <aside className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm h-fit">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-black text-slate-950">Danh sách bệnh nhân</h2>
                <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{filteredPatients.length}</span>
              </div>
              <div className="max-h-[640px] overflow-y-auto space-y-2 pr-1">
                {filteredPatients.map((patient) => (
                  <PatientButton
                    key={patient.id}
                    patient={patient}
                    active={selectedPatient?.id === patient.id}
                    visitCount={visits.filter((visit) => visit.patientId === patient.id || visit.patient?.id === patient.id).length}
                    onClick={() => setSelectedPatientId(patient.id)}
                  />
                ))}
                {!filteredPatients.length && <Empty title="Không có bệnh nhân phù hợp" />}
              </div>
            </aside>

            <main className="space-y-5">
              {selectedPatient ? (
                <>
                  <PatientDetail patient={selectedPatient} visitCount={patientVisits.length} latestVisit={latestVisit} />
                  <VisitHistory visits={patientVisits} />
                </>
              ) : <Empty title="Chọn bệnh nhân để xem chi tiết" />}
            </main>
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}

function PatientButton({ patient, active, visitCount, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`w-full rounded-2xl border p-4 text-left transition-all ${active ? 'border-blue-300 bg-blue-50 shadow-sm ring-2 ring-blue-50' : 'border-slate-100 bg-white hover:bg-slate-50 hover:border-slate-200'}`}>
      <div className="flex items-center gap-3">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-xs font-black ${active ? 'bg-blue-600 text-white' : 'bg-cyan-50 text-cyan-700'}`}>{patient.fullName?.slice(0, 2).toUpperCase()}</div>
        <div className="min-w-0 flex-1">
          <strong className="block truncate text-sm text-slate-950">{patient.fullName}</strong>
          <span className="text-xs font-semibold text-slate-500">{patient.patientCode} · {patient.phone || 'Chưa có SĐT'}</span>
        </div>
        <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-slate-500 border border-slate-100">{visitCount}</span>
      </div>
    </button>
  );
}

function PatientDetail({ patient, visitCount, latestVisit }) {
  const latestStatus = latestVisit ? getVisitStatus(latestVisit.status) : null;
  return (
    <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-blue-600 to-cyan-500 text-lg font-black text-white shadow-lg shadow-blue-100">{patient.fullName?.slice(0, 2).toUpperCase()}</div>
          <div>
            <h2 className="text-2xl font-black text-slate-950">{patient.fullName}</h2>
            <p className="mt-1 text-sm font-bold text-slate-500">{patient.patientCode}</p>
          </div>
        </div>
        {latestStatus && <span className={`inline-flex w-fit items-center rounded-full border px-3 py-1.5 text-xs font-black ${latestStatus.color}`}><span className={`mr-2 h-2 w-2 rounded-full ${latestStatus.dot}`} />Lượt gần nhất: {latestStatus.label}</span>}
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <Info label="Ngày sinh" value={patient.birthDate ? new Date(patient.birthDate).toLocaleDateString('vi-VN') : 'Chưa cập nhật'} />
        <Info label="Giới tính" value={patient.gender === 'MALE' ? 'Nam' : patient.gender === 'FEMALE' ? 'Nữ' : 'Khác'} />
        <Info label="CCCD" value={patient.citizenId || 'Chưa cập nhật'} />
        <Info label="Số điện thoại" value={patient.phone || 'Chưa cập nhật'} />
        <Info label="BHYT" value={patient.insuranceNumber || 'Chưa cập nhật'} />
        <Info label="Liên hệ khẩn cấp" value={patient.emergencyContact || 'Chưa cập nhật'} />
        <Info label="Số lượt khám" value={`${visitCount} lượt`} />
        <Info label="Địa chỉ" value={patient.address || 'Chưa cập nhật'} />
      </div>
    </section>
  );
}

function VisitHistory({ visits }) {
  return (
    <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-black text-slate-950">Lịch sử lượt khám</h2>
        <span className="rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-700">{visits.length}</span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-100">
        <div className="divide-y divide-slate-100">
          {visits.map((visit) => <VisitRow key={visit.id} visit={visit} />)}
          {!visits.length && <Empty title="Bệnh nhân chưa có lượt khám" />}
        </div>
      </div>
    </section>
  );
}

function VisitRow({ visit }) {
  const st = getVisitStatus(visit.status);
  return (
    <div className="grid grid-cols-1 gap-3 bg-white p-4 hover:bg-slate-50 md:grid-cols-[1fr_180px_180px] md:items-center">
      <div>
        <strong className="text-sm font-black text-slate-950">{visit.visitCode}</strong>
        <p className="mt-1 text-xs font-semibold text-slate-500">{visit.clinicalRoom?.roomName || 'Chưa có phòng'} · BS. {visit.doctor?.staffProfile?.fullName || 'N/A'}</p>
        {visit.symptoms && <p className="mt-1 text-xs font-medium text-slate-400 line-clamp-1">{visit.symptoms}</p>}
      </div>
      <span className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-[10px] font-black ${st.color}`}><span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${st.dot}`} />{st.label}</span>
      <span className="text-xs font-semibold text-slate-500 md:text-right">{visit.createdAt ? new Date(visit.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : 'N/A'}</span>
    </div>
  );
}

function Info({ label, value }) { return <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-sm font-bold text-slate-800 break-words">{value}</p></div>; }
function Empty({ title }) { return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-bold text-slate-400">{title}</div>; }

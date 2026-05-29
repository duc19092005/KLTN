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
        setPatients(getItems(patientRes.data));
        setVisits(getItems(visitRes.data));
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

  const filteredVisits = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return visits;
    return visits.filter((visit) => [visit.visitCode, visit.patient?.fullName, visit.patient?.patientCode, visit.clinicalRoom?.roomName, visit.doctor?.staffProfile?.fullName, getVisitStatus(visit.status).label].filter(Boolean).some((value) => String(value).toLowerCase().includes(text)));
  }, [query, visits]);

  return (
    <DashboardLayout user={user} navItems={RECEPTIONIST_NAV_ITEMS} activeItem="patient-records" onNavigate={(id) => navigate(receptionistRouteFor(id))} onLogout={logout}>
      <div className="max-w-7xl mx-auto space-y-6">
        <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-600">Hồ sơ bệnh nhân</p>
              <h1 className="mt-1 text-2xl font-black text-slate-950">Tra cứu hồ sơ</h1>
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm bệnh nhân, mã lượt, trạng thái..."
              className="w-full lg:w-[360px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold outline-none focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-50"
            />
          </div>
        </section>

        {error && <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
        {loading ? <LoadingIndicator size="lg" label="Đang tải hồ sơ..." /> : (
          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card title="Bệnh nhân" count={filteredPatients.length}>
              <div className="space-y-3 max-h-[680px] overflow-y-auto pr-1">
                {filteredPatients.map((p) => <PatientMini key={p.id} patient={p} />)}
                {!filteredPatients.length && <Empty title="Không có bệnh nhân phù hợp" />}
              </div>
            </Card>
            <Card title="Lượt khám" count={filteredVisits.length}>
              <div className="space-y-3 max-h-[680px] overflow-y-auto pr-1">
                {filteredVisits.map((v) => <VisitMini key={v.id} visit={v} />)}
                {!filteredVisits.length && <Empty title="Không có lượt khám phù hợp" />}
              </div>
            </Card>
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}

function Card({ title, count, children }) {
  return <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-black text-slate-950">{title}</h2><span className="rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-700">{count}</span></div>{children}</section>;
}
function Empty({ title }) { return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">{title}</div>; }
function PatientMini({ patient }) { return <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"><strong className="block text-slate-950">{patient.fullName}</strong><span className="text-xs text-slate-500">{patient.patientCode} · {patient.phone || 'Chưa có SĐT'} · {patient.citizenId || 'Chưa có CCCD'}</span></div>; }
function VisitMini({ visit }) {
  const st = getVisitStatus(visit.status);
  return <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"><div className="flex items-start justify-between gap-3"><div><strong className="text-slate-950">{visit.visitCode}</strong><p className="mt-1 text-sm font-bold text-slate-700">{visit.patient?.fullName || 'N/A'}</p></div><span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black ${st.color}`}><span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${st.dot}`} />{st.label}</span></div><p className="mt-2 text-xs font-semibold text-slate-500">{visit.clinicalRoom?.roomName || 'Chưa có phòng'} · BS. {visit.doctor?.staffProfile?.fullName || 'N/A'}</p></div>;
}

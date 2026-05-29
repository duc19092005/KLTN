import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { visitService } from '../apis/visitService';
import { patientService } from '../apis/patientService';
import { RECEPTIONIST_NAV_ITEMS, receptionistRouteFor } from '../constants/navigation';

function getItems(data) { return Array.isArray(data) ? data : data?.items || []; }

export default function ReceptionistRecordsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [visits, setVisits] = useState([]);
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

  return (
    <DashboardLayout user={user} navItems={RECEPTIONIST_NAV_ITEMS} activeItem="patient-records" onNavigate={(id) => navigate(receptionistRouteFor(id))} onLogout={logout}>
      <div className="max-w-7xl mx-auto space-y-6">
        <section className="rounded-[28px] border border-violet-100 bg-gradient-to-br from-white via-violet-50 to-cyan-50 p-8 shadow-sm">
          <p className="text-[11px] font-black text-violet-600 uppercase tracking-[0.24em] mb-3">Patient Records</p>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">Hồ sơ bệnh nhân</h1>
          <p className="mt-3 max-w-3xl text-sm sm:text-base text-slate-600 leading-relaxed">Trang riêng để tra cứu hồ sơ bệnh nhân gần đây và các lượt khám mới nhất.</p>
        </section>
        {error && <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
        {loading ? <LoadingIndicator size="lg" label="Đang tải hồ sơ..." /> : (
          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card title="Bệnh nhân gần đây" subtitle={`${patients.length} hồ sơ trong hệ thống`}>
              <div className="space-y-3 max-h-[680px] overflow-y-auto pr-1">
                {patients.map((p) => <PatientMini key={p.id} patient={p} />)}
                {!patients.length && <Empty title="Chưa có hồ sơ bệnh nhân" desc="Hãy tiếp nhận bệnh nhân đầu tiên để tạo dữ liệu." />}
              </div>
            </Card>
            <Card title="Lượt khám mới nhất" subtitle={`${visits.length} lượt khám gần đây`}>
              <div className="space-y-3 max-h-[680px] overflow-y-auto pr-1">
                {visits.map((v) => <VisitMini key={v.id} visit={v} />)}
                {!visits.length && <Empty title="Chưa có lượt khám" desc="Sau khi tạo Visit, dữ liệu sẽ xuất hiện tại đây." />}
              </div>
            </Card>
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}

function Card({ title, subtitle, children }) { return <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm"><div className="mb-5"><h2 className="text-xl font-black text-slate-950">{title}</h2><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div>{children}</section>; }
function Empty({ title, desc }) { return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center"><strong className="text-slate-800">{title}</strong><p className="mt-1 text-sm text-slate-500">{desc}</p></div>; }
function PatientMini({ patient }) { return <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><strong className="block text-slate-950">{patient.fullName}</strong><span className="text-xs text-slate-500">{patient.patientCode} · {patient.phone || 'Chưa có SĐT'} · {patient.citizenId || 'Chưa có CCCD'}</span></div>; }
function VisitMini({ visit }) { return <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><strong className="text-slate-950">{visit.visitCode}</strong><span className="text-[10px] font-black text-cyan-700 bg-cyan-50 border border-cyan-100 rounded-full px-2 py-1">{visit.status}</span></div><p className="mt-1 text-sm text-slate-600">{visit.patient?.fullName || 'N/A'}</p><p className="text-xs text-slate-500">{visit.clinicalRoom?.roomName || 'Chưa có phòng'} · BS. {visit.doctor?.staffProfile?.fullName || 'N/A'}</p></div>; }

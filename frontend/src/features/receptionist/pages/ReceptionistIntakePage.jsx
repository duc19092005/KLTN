import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import { useAuth } from '../../../providers/AuthProvider';
import PatientFinder from '../components/PatientFinder';
import CreateVisitForm from '../components/CreateVisitForm';
import { RECEPTIONIST_NAV_ITEMS, receptionistRouteFor } from '../constants/navigation';

export default function ReceptionistIntakePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');

  const handleVisitCreated = (visit) => {
    setStatusMsg(`Đã tạo thành công lượt khám ${visit.visitCode} cho bệnh nhân ${visit.patient?.fullName}`);
    setSelectedPatient(null);
    setTimeout(() => navigate('/receptionist/queue'), 900);
  };

  return (
    <DashboardLayout user={user} navItems={RECEPTIONIST_NAV_ITEMS} activeItem="patient-intake" onNavigate={(id) => navigate(receptionistRouteFor(id))} onLogout={logout}>
      <div className="max-w-5xl mx-auto space-y-6">
        <Hero title="Tiếp nhận bệnh nhân" desc="Tìm hồ sơ theo CCCD/SĐT/tên. Nếu chưa có hồ sơ, tạo bệnh nhân mới rồi lập lượt khám và gán phòng/bác sĩ." />
        {statusMsg && <Alert message={statusMsg} />}
        <Card title="Luồng tiếp nhận" subtitle="Tách riêng khỏi Dashboard để lễ tân tập trung xử lý từng bệnh nhân.">
          {!selectedPatient ? <PatientFinder onPatientSelected={setSelectedPatient} /> : (
            <CreateVisitForm patient={selectedPatient} onCancel={() => setSelectedPatient(null)} onVisitCreated={handleVisitCreated} />
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}

function Hero({ title, desc }) { return <section className="rounded-[28px] border border-cyan-100 bg-gradient-to-br from-white via-cyan-50 to-blue-50 p-8 shadow-sm"><p className="text-[11px] font-black text-cyan-600 uppercase tracking-[0.24em] mb-3">Reception Intake</p><h1 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">{title}</h1><p className="mt-3 max-w-3xl text-sm sm:text-base text-slate-600 leading-relaxed">{desc}</p></section>; }
function Card({ title, subtitle, children }) { return <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm"><div className="mb-5"><h2 className="text-xl font-black text-slate-950">{title}</h2><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div>{children}</section>; }
function Alert({ message }) { return <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{message}</div>; }

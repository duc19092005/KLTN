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
    setStatusMsg(`Đã tạo lượt khám ${visit.visitCode} cho ${visit.patient?.fullName}`);
    setSelectedPatient(null);
    setTimeout(() => navigate('/receptionist/queue'), 900);
  };

  return (
    <DashboardLayout user={user} navItems={RECEPTIONIST_NAV_ITEMS} activeItem="patient-intake" onNavigate={(id) => navigate(receptionistRouteFor(id))} onLogout={logout}>
      <div className="mx-auto max-w-6xl space-y-5">
        <section className="rounded-3xl border border-cyan-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-600">Tiếp nhận</p>
              <h1 className="mt-1 text-2xl font-black text-slate-950">Tạo lượt khám</h1>
            </div>
            <StepBar selectedPatient={selectedPatient} />
          </div>
        </section>

        {statusMsg && <Alert message={statusMsg} />}

        <section className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_1fr]">
          <PatientSummary patient={selectedPatient} onClear={() => setSelectedPatient(null)} />
          <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
            {!selectedPatient ? (
              <PatientFinder onPatientSelected={setSelectedPatient} />
            ) : (
              <CreateVisitForm patient={selectedPatient} onCancel={() => setSelectedPatient(null)} onVisitCreated={handleVisitCreated} />
            )}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}

function StepBar({ selectedPatient }) {
  const steps = [
    { no: 1, label: 'Tìm hồ sơ', active: !selectedPatient, done: Boolean(selectedPatient) },
    { no: 2, label: 'Chọn phòng', active: Boolean(selectedPatient), done: false },
    { no: 3, label: 'Tạo lượt', active: false, done: false },
  ];
  return <div className="flex items-center gap-3">{steps.map((step, index) => <React.Fragment key={step.no}><div className="flex items-center gap-2"><span className={`grid h-8 w-8 place-items-center rounded-full border text-xs font-black ${step.done ? 'border-emerald-500 bg-emerald-500 text-white' : step.active ? 'border-cyan-600 bg-cyan-600 text-white ring-4 ring-cyan-50' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>{step.no}</span><span className="hidden text-xs font-black text-slate-600 sm:block">{step.label}</span></div>{index < steps.length - 1 && <span className="h-px w-8 bg-slate-200" />}</React.Fragment>)}</div>;
}

function PatientSummary({ patient, onClear }) {
  return (
    <aside className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm h-fit">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Bệnh nhân đã chọn</p>
      {patient ? (
        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-50 text-sm font-black text-cyan-700">{patient.fullName?.slice(0, 2).toUpperCase()}</div>
            <div className="min-w-0"><h2 className="truncate text-base font-black text-slate-950">{patient.fullName}</h2><p className="text-xs font-semibold text-slate-500">{patient.patientCode}</p></div>
          </div>
          <div className="space-y-2 rounded-2xl bg-slate-50 p-3 text-xs font-semibold text-slate-600">
            <p>CCCD: <span className="text-slate-900">{patient.citizenId || 'Chưa cập nhật'}</span></p>
            <p>SĐT: <span className="text-slate-900">{patient.phone || 'Chưa cập nhật'}</span></p>
            <p>Ngày sinh: <span className="text-slate-900">{patient.birthDate ? new Date(patient.birthDate).toLocaleDateString('vi-VN') : 'N/A'}</span></p>
          </div>
          <button type="button" onClick={onClear} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black text-slate-600 hover:bg-slate-50">Đổi bệnh nhân</button>
        </div>
      ) : <p className="mt-4 text-sm font-semibold text-slate-500">Tìm bệnh nhân cũ hoặc tạo hồ sơ mới để bắt đầu.</p>}
    </aside>
  );
}

function Alert({ message }) { return <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{message}</div>; }

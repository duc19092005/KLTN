import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import { useAuth } from '../../../providers/AuthProvider';
import PatientFinder from '../components/PatientFinder';
import CreateVisitForm from '../components/CreateVisitForm';
import { FRONTDESK_NAV_ITEMS, frontdeskRouteFor } from '../constants/frontdeskNavigation';
import { useToast } from '../../../providers/ToastProvider';
import { UserCheck, CalendarPlus, User, Phone, CreditCard, Calendar, CheckCircle2, ArrowRight } from 'lucide-react';

export default function ReceptionistIntakePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [selectedPatient, setSelectedPatient] = useState(() => location.state?.patient || null);

  const handleVisitCreated = (visit) => {
    toast.success(`Đã tạo lượt khám ${visit.visitCode} thành công!`);
    setSelectedPatient(null);
    navigate('/receptionist/queue');
  };

  return (
    <DashboardLayout
      user={user}
      navItems={FRONTDESK_NAV_ITEMS}
      activeItem="patient-intake"
      onNavigate={(id) => navigate(frontdeskRouteFor(id))}
      onLogout={logout}
    >
      <div className="mx-auto max-w-[1600px] space-y-6 pb-12 antialiased">
        {/* HERO STEPPER BANNER */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-sky-50/80 blur-2xl pointer-events-none" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-lg shadow-sky-600/25 shrink-0">
                <CalendarPlus className="w-6 h-6" strokeWidth={2} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-sky-600 bg-sky-50 px-2.5 py-0.5 rounded-md border border-sky-100">
                    Phân hệ Lễ tân
                  </span>
                  <span className="text-xs font-semibold text-slate-400">• Tiếp nhận lượt khám</span>
                </div>
                <h1 className="mt-1 text-2xl font-bold text-slate-900 tracking-tight">
                  Tạo lượt khám bệnh nhân
                </h1>
              </div>
            </div>

            {/* Stepper Indicator */}
            <StepBar selectedPatient={selectedPatient} />
          </div>
        </section>

        {/* MAIN WORKFLOW GRID */}
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)] items-start">
          {/* LEFT: PATIENT SUMMARY CARD */}
          <PatientSummary patient={selectedPatient} onClear={() => setSelectedPatient(null)} />

          {/* RIGHT: DYNAMIC WORKFLOW PANEL (PATIENT FINDER OR VISIT FORM) */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
            {!selectedPatient ? (
              <PatientFinder onPatientSelected={setSelectedPatient} />
            ) : (
              <CreateVisitForm
                patient={selectedPatient}
                onCancel={() => setSelectedPatient(null)}
                onVisitCreated={handleVisitCreated}
              />
            )}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}

function StepBar({ selectedPatient }) {
  const steps = [
    { no: 1, label: 'Tra cứu/Chọn BN', active: !selectedPatient, done: Boolean(selectedPatient) },
    { no: 2, label: 'Chọn phòng khám', active: Boolean(selectedPatient), done: false },
    { no: 3, label: 'Hoàn tất tạo lượt', active: false, done: false },
  ];

  return (
    <div className="flex items-center gap-2 sm:gap-4 bg-slate-50 border border-slate-200/80 p-2.5 rounded-2xl">
      {steps.map((step, index) => (
        <React.Fragment key={step.no}>
          <div className="flex items-center gap-2.5">
            <span
              className={`grid h-8 w-8 place-items-center rounded-xl text-xs font-black transition-all ${
                step.done
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : step.active
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30 ring-4 ring-sky-100'
                  : 'bg-white text-slate-400 border border-slate-200'
              }`}
            >
              {step.done ? <CheckCircle2 className="w-4 h-4" strokeWidth={2.5} /> : step.no}
            </span>
            <span
              className={`hidden sm:inline text-xs font-bold ${
                step.active || step.done ? 'text-slate-900 font-extrabold' : 'text-slate-400'
              }`}
            >
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div className="h-4 w-[1px] bg-slate-200" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function PatientSummary({ patient, onClear }) {
  return (
    <aside className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm xl:sticky xl:top-24">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-sky-600">
            Thông tin bệnh nhân
          </p>
          <h2 className="text-base font-bold text-slate-900">
            {patient ? 'Đã chọn bệnh nhân' : 'Chưa chọn bệnh nhân'}
          </h2>
        </div>
        {patient && (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-100 flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5" /> Sẵn sàng
          </span>
        )}
      </div>

      {patient ? (
        <div className="mt-5 space-y-5">
          <div className="flex items-center gap-3.5">
            <div className="w-13 h-13 rounded-2xl bg-sky-100 text-sky-700 font-black text-lg flex items-center justify-center shrink-0 border border-sky-200/80 shadow-xs">
              {patient.fullName?.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-base font-bold text-slate-900">
                {patient.fullName}
              </h3>
              <p className="text-xs font-bold text-sky-600 mt-0.5">
                Mã BN: {patient.patientCode}
              </p>
            </div>
          </div>

          <div className="space-y-2.5 rounded-2xl bg-slate-50/80 border border-slate-100 p-4 text-xs font-medium text-slate-600">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5 text-slate-400" /> CCCD:</span>
              <strong className="text-slate-900 font-bold">{patient.citizenId || 'Chưa cập nhật'}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-400" /> Số điện thoại:</span>
              <strong className="text-slate-900 font-bold">{patient.phone || 'Chưa cập nhật'}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-400" /> Ngày sinh:</span>
              <strong className="text-slate-900 font-bold">
                {patient.birthDate ? new Date(patient.birthDate).toLocaleDateString('vi-VN') : 'N/A'}
              </strong>
            </div>
          </div>

          <button
            type="button"
            onClick={onClear}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-xs"
          >
            Đổi bệnh nhân khác
          </button>
        </div>
      ) : (
        <div className="mt-6 text-center py-8 px-4 rounded-2xl bg-slate-50/60 border border-dashed border-slate-200">
          <div className="w-12 h-12 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center mx-auto mb-3">
            <User className="w-6 h-6 stroke-[1.75]" />
          </div>
          <p className="text-xs font-bold text-slate-700">Vui lòng tra cứu hoặc chọn bệnh nhân</p>
          <p className="text-[11px] font-medium text-slate-400 mt-1">
            Nhập CCCD, SĐT hoặc Họ tên bệnh nhân ở ô tra cứu bên phải.
          </p>
        </div>
      )}
    </aside>
  );
}

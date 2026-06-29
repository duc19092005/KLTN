import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import { useAuth } from '../../../providers/AuthProvider';
import { useToast } from '../../../providers/ToastProvider';
import { FRONTDESK_NAV_ITEMS, frontdeskRouteFor } from '../constants/frontdeskNavigation';
import { appointmentService } from '../apis/appointmentService';

export default function ReceptionistAppointmentCheckInPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [qrPayload, setQrPayload] = useState('');
  const [verification, setVerification] = useState(null);
  const [reason, setReason] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const verifyQr = async () => {
    setBusy(true);
    setError('');
    try {
      const data = await appointmentService.verifyQr(qrPayload.trim());
      setVerification(data);
      setReason(data?.appointment?.reason || 'Khám theo lịch hẹn');
      setSymptoms(data?.appointment?.symptoms || '');
      toast.success('Mã QR hợp lệ. Vui lòng xác minh thông tin bệnh nhân.');
    } catch (err) {
      setVerification(null);
      setError(err.response?.data?.message || err.message || 'Không xác minh được mã QR.');
    } finally {
      setBusy(false);
    }
  };

  const checkIn = async () => {
    setBusy(true);
    setError('');
    try {
      const data = await appointmentService.checkIn(qrPayload.trim(), { reason, symptoms });
      toast.success(`Check-in thành công. Đã tạo lượt khám ${data?.visit?.visitCode || ''}`);
      navigate('/receptionist/queue');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Không check-in được lịch hẹn.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardLayout user={user} navItems={FRONTDESK_NAV_ITEMS} activeItem="appointment-checkin" onNavigate={(id) => navigate(frontdeskRouteFor(id))} onLogout={logout}>
      <div className="mx-auto max-w-6xl space-y-5">
        <section className="overflow-hidden rounded-3xl border border-cyan-100 bg-gradient-to-br from-cyan-600 via-sky-600 to-indigo-700 p-6 text-white shadow-xl shadow-cyan-100">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-100">QR Check-in</p>
              <h1 className="mt-2 text-3xl font-black">Tiếp nhận lịch hẹn tại nhà</h1>
              <p className="mt-2 max-w-2xl text-sm font-semibold text-cyan-50">Quét hoặc dán mã QR từ ứng dụng bệnh nhân, xác minh thông tin, sau đó tạo lượt khám và chuyển vào hàng chờ.</p>
            </div>
            <div className="rounded-2xl bg-white/15 px-4 py-3 text-sm font-bold backdrop-blur">
              Appointment → Visit → Queue
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_380px]">
          <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
            <label className="text-xs font-black uppercase tracking-wider text-slate-500">Dữ liệu QR</label>
            <textarea
              value={qrPayload}
              onChange={(event) => setQrPayload(event.target.value)}
              rows={5}
              placeholder="KLTN_APPOINTMENT_CHECKIN:..."
              className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-50"
            />
            {error ? <div className="mt-3 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div> : null}
            <div className="mt-4 flex flex-wrap gap-3">
              <button disabled={busy || !qrPayload.trim()} onClick={verifyQr} className="rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-cyan-100 transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50">
                {busy ? 'Đang xử lý...' : 'Xác minh QR'}
              </button>
              <button type="button" onClick={() => { setQrPayload(''); setVerification(null); setError(''); }} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600 hover:bg-slate-50">
                Làm mới
              </button>
            </div>
          </div>

          <aside className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wider text-slate-500">Trạng thái</p>
            <div className="mt-4 rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-black text-slate-900">{verification ? 'QR hợp lệ' : 'Chưa xác minh'}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">QR không chứa dữ liệu cá nhân; hệ thống chỉ đối chiếu token đã hash.</p>
            </div>
          </aside>
        </section>

        {verification ? (
          <section className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_1fr]">
            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">Bệnh nhân</p>
              <div className="mt-4 flex items-center gap-3">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-cyan-50 text-lg font-black text-cyan-700">{verification.patient?.fullName?.slice(0, 2).toUpperCase()}</div>
                <div>
                  <h2 className="text-lg font-black text-slate-950">{verification.patient?.fullName}</h2>
                  <p className="text-xs font-bold text-slate-500">{verification.patient?.patientCode}</p>
                </div>
              </div>
              <div className="mt-4 space-y-2 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                <p>Ngày sinh: <span className="text-slate-950">{verification.patient?.birthDate ? new Date(verification.patient.birthDate).toLocaleDateString('vi-VN') : 'N/A'}</span></p>
                <p>CCCD: <span className="text-slate-950">{verification.patient?.citizenId || 'Chưa có'}</span></p>
                <p>SĐT: <span className="text-slate-950">{verification.patient?.contactPhone || verification.patient?.phone || 'Chưa có'}</span></p>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-slate-500">Lịch hẹn</p>
                  <h2 className="mt-1 text-xl font-black text-slate-950">{verification.appointment?.appointmentCode}</h2>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{verification.appointment?.status}</span>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <InfoCard label="Khoa khám" value={verification.department?.name || 'N/A'} />
                <InfoCard label="Bác sĩ" value={verification.doctor?.fullName || 'Bác sĩ bất kỳ'} />
                <InfoCard label="Ngày khám" value={verification.appointment?.scheduledAt ? new Date(verification.appointment.scheduledAt).toLocaleDateString('vi-VN') : 'N/A'} />
                <InfoCard label="Giờ khám" value={verification.appointment?.scheduledAt ? new Date(verification.appointment.scheduledAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'N/A'} />
              </div>

              <div className="mt-5 grid gap-3">
                <label className="text-xs font-black uppercase tracking-wider text-slate-500">Lý do khám</label>
                <input value={reason} onChange={(event) => setReason(event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-50" />
                <label className="text-xs font-black uppercase tracking-wider text-slate-500">Triệu chứng ghi nhận</label>
                <textarea value={symptoms} onChange={(event) => setSymptoms(event.target.value)} rows={3} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-50" />
              </div>

              <button disabled={busy} onClick={checkIn} className="mt-5 w-full rounded-2xl bg-gradient-to-r from-cyan-600 to-sky-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-cyan-100 transition hover:from-cyan-700 hover:to-sky-700 disabled:cursor-not-allowed disabled:opacity-50">
                {busy ? 'Đang check-in...' : 'Xác nhận check-in và tạo lượt khám'}
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </DashboardLayout>
  );
}

function InfoCard({ label, value }) {
  return <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-sm font-black text-slate-900">{value}</p></div>;
}

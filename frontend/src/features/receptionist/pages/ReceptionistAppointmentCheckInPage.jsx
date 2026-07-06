import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
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
  const [scannerActive, setScannerActive] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanFrameRef = useRef(0);

  useEffect(() => () => stopScanner(), []);

  const stopScanner = () => {
    if (scanFrameRef.current) cancelAnimationFrame(scanFrameRef.current);
    scanFrameRef.current = 0;
    streamRef.current?.getTracks?.().forEach((track) => track.stop());
    streamRef.current = null;
    setScannerActive(false);
  };

  const scanFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      scanFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    const context = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const result = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });

    if (result?.data) {
      const payload = result.data.trim();
      setQrPayload(payload);
      stopScanner();
      toast.success('Đã quét QR. Đang xác minh lịch hẹn...');
      verifyQr(payload);
      return;
    }

    scanFrameRef.current = requestAnimationFrame(scanFrame);
  };

  const startScanner = async () => {
    setScannerError('');
    setError('');
    setVerification(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setScannerError('Trình duyệt không hỗ trợ camera. Vui lòng dùng Chrome/Edge hoặc dán mã QR.');
        return;
      }

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      streamRef.current = stream;
      setScannerActive(true);

      requestAnimationFrame(async () => {
        if (!videoRef.current || streamRef.current !== stream) return;
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play?.();
          scanFrameRef.current = requestAnimationFrame(scanFrame);
        };
        try {
          await videoRef.current.play();
          scanFrameRef.current = requestAnimationFrame(scanFrame);
        } catch {
          // Some browsers require onloadedmetadata before play; the handler above will retry.
        }
      });
    } catch (cameraError) {
      setScannerError(cameraError?.message || 'Không mở được camera. Hãy cấp quyền camera hoặc nhập mã thủ công.');
      stopScanner();
    }
  };

  const verifyQr = async (payloadOverride) => {
    const payload = (payloadOverride || qrPayload).trim();
    if (!payload) return;
    setBusy(true);
    setError('');
    try {
      const data = await appointmentService.verifyQr(payload);
      setVerification(data);
      setReason(data?.appointment?.reason || 'Khám theo lịch hẹn');
      setSymptoms(data?.appointment?.symptoms || '');
      toast.success('Mã QR hợp lệ. Vui lòng xác minh thông tin bệnh nhân.');
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Không xác minh được mã QR.';
      const friendlyMessage = message.includes('đã được check-in')
        ? 'Bệnh nhân đã check-in lịch hẹn này rồi, không thể check-in lại.'
        : message;
      setVerification(null);
      setError(friendlyMessage);
      toast.error(friendlyMessage);
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
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="overflow-hidden rounded-2xl border border-cyan-100 bg-white shadow-sm">
          <div className="relative p-6">
            <div className="absolute right-0 top-0 h-28 w-56 rounded-bl-[48px] bg-cyan-50" />
            <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-600">Check-in QR</p>
                <h1 className="mt-1 text-2xl font-black text-slate-950">Tiếp nhận lịch hẹn</h1>
                <p className="mt-1 max-w-2xl text-xs font-semibold text-slate-500">Quét QR, xác minh thông tin lịch hẹn và chuyển bệnh nhân vào hàng đợi khám.</p>
              </div>
              <button type="button" onClick={() => navigate('/receptionist/queue')} className="w-fit rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700 shadow-sm hover:bg-slate-50">Xem hàng đợi</button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.25fr)_360px]">
          <ScannerPanel
            qrPayload={qrPayload}
            setQrPayload={setQrPayload}
            busy={busy}
            scannerActive={scannerActive}
            scannerError={scannerError}
            videoRef={videoRef}
            canvasRef={canvasRef}
            onStart={startScanner}
            onStop={stopScanner}
            onVerify={() => verifyQr()}
          />
          <StatusPanel error={error} verification={verification} />
        </section>

        {verification ? (
          <section className="grid grid-cols-1 gap-5 lg:grid-cols-[380px_1fr]">
            <PatientCard patient={verification.patient} />
            <AppointmentCard
              verification={verification}
              reason={reason}
              symptoms={symptoms}
              busy={busy}
              onReasonChange={setReason}
              onSymptomsChange={setSymptoms}
              onCheckIn={checkIn}
            />
          </section>
        ) : null}
      </div>
    </DashboardLayout>
  );
}

function ScannerPanel({ qrPayload, setQrPayload, busy, scannerActive, scannerError, videoRef, canvasRef, onStart, onStop, onVerify }) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-600">Máy quét</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">Quét mã QR lịch hẹn</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">Đưa mã QR vào vùng quét hoặc dán mã thủ công.</p>
        </div>
        <button type="button" onClick={scannerActive ? onStop : onStart} className={`min-h-[44px] w-fit rounded-xl px-4 py-2.5 text-xs font-black text-white shadow-sm transition ${scannerActive ? 'bg-rose-600 hover:bg-rose-700' : 'bg-cyan-600 hover:bg-cyan-700'}`}>
          {scannerActive ? 'Dừng camera' : 'Mở camera'}
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-3">
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          {scannerActive ? (
            <div className="relative aspect-[16/9] w-full bg-slate-900">
              <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
              <div className="pointer-events-none absolute inset-0 grid place-items-center bg-slate-900/10">
                <div className="relative h-48 w-48 rounded-3xl border-2 border-white/70 shadow-[0_0_0_999px_rgba(15,23,42,0.22)]">
                  <span className="absolute -left-1 -top-1 h-9 w-9 rounded-tl-3xl border-l-[5px] border-t-[5px] border-cyan-300" />
                  <span className="absolute -right-1 -top-1 h-9 w-9 rounded-tr-3xl border-r-[5px] border-t-[5px] border-cyan-300" />
                  <span className="absolute -bottom-1 -left-1 h-9 w-9 rounded-bl-3xl border-b-[5px] border-l-[5px] border-cyan-300" />
                  <span className="absolute -bottom-1 -right-1 h-9 w-9 rounded-br-3xl border-b-[5px] border-r-[5px] border-cyan-300" />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid min-h-[260px] place-items-center bg-[radial-gradient(circle_at_top,_#ecfeff,_#f8fafc_60%)] p-8 text-center">
              <div>
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-white text-xl font-black text-cyan-700 shadow-sm ring-1 ring-cyan-100">QR</div>
                <p className="mt-3 text-sm font-black text-slate-900">Sẵn sàng quét lịch hẹn</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">Camera chưa bật. Bấm “Mở camera” để bắt đầu.</p>
              </div>
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>
      </div>

      {scannerError ? <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">{scannerError}</div> : null}

      <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <label htmlFor="appointment-qr-payload" className="text-[11px] font-black uppercase tracking-wider text-slate-500">Mã QR thủ công</label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id="appointment-qr-payload"
            value={qrPayload}
            onChange={(event) => setQrPayload(event.target.value)}
            placeholder="Dán payload QR lịch hẹn..."
            className="min-h-[44px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-50"
          />
          <button type="button" disabled={busy || !qrPayload.trim()} onClick={onVerify} className="min-h-[44px] rounded-xl bg-cyan-600 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-cyan-700 disabled:opacity-60">
            {busy ? 'Đang kiểm tra...' : 'Xác minh'}
          </button>
        </div>
      </div>
    </section>
  );
}

function StatusPanel({ error, verification }) {
  const tone = error ? 'rose' : verification ? 'emerald' : 'slate';
  const title = error || (verification ? 'QR hợp lệ' : 'Chưa xác minh');
  const desc = error
    ? 'Vui lòng kiểm tra lại mã QR hoặc trạng thái lịch hẹn.'
    : verification
      ? 'Thông tin lịch hẹn đã sẵn sàng để check-in.'
      : 'Quét hoặc dán mã QR để bắt đầu xác minh.';

  return (
    <aside className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-600">Trạng thái xử lý</p>
      <h2 className="mt-1 text-lg font-black text-slate-950">Kết quả xác minh</h2>
      <div className={`mt-4 rounded-2xl border p-4 ${tone === 'rose' ? 'border-rose-100 bg-rose-50' : tone === 'emerald' ? 'border-emerald-100 bg-emerald-50' : 'border-slate-100 bg-slate-50'}`}>
        <p className={`text-sm font-black ${tone === 'rose' ? 'text-rose-700' : tone === 'emerald' ? 'text-emerald-700' : 'text-slate-800'}`}>{title}</p>
        <p className="mt-1 text-xs font-semibold text-slate-500">{desc}</p>
      </div>
      <div className="mt-4 grid gap-3 text-xs font-semibold text-slate-500">
        <Step no="1" label="Quét hoặc dán mã QR" done={Boolean(error || verification)} />
        <Step no="2" label="Xác minh bệnh nhân và lịch hẹn" done={Boolean(verification)} />
        <Step no="3" label="Check-in và tạo lượt khám" done={false} />
      </div>
    </aside>
  );
}

function Step({ no, label, done }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
      <span className={`grid h-7 w-7 place-items-center rounded-full text-[11px] font-black ${done ? 'bg-cyan-600 text-white' : 'bg-white text-slate-400'}`}>{no}</span>
      <span>{label}</span>
    </div>
  );
}

function PatientCard({ patient }) {
  return (
    <section className="h-fit rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-600">Bệnh nhân</p>
      <div className="mt-4 flex items-center gap-3">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-cyan-50 text-lg font-black text-cyan-700">{patient?.fullName?.slice(0, 2).toUpperCase()}</div>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-black text-slate-950">{patient?.fullName}</h2>
          <p className="text-xs font-bold text-slate-500">{patient?.patientCode}</p>
        </div>
      </div>
      <div className="mt-4 space-y-2 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">
        <p>Ngày sinh: <span className="text-slate-950">{patient?.birthDate ? new Date(patient.birthDate).toLocaleDateString('vi-VN') : 'N/A'}</span></p>
        <p>CCCD: <span className="text-slate-950">{patient?.citizenId || 'Chưa có'}</span></p>
        <p>SĐT: <span className="text-slate-950">{patient?.contactPhone || patient?.phone || 'Chưa có'}</span></p>
      </div>
    </section>
  );
}

function AppointmentCard({ verification, reason, symptoms, busy, onReasonChange, onSymptomsChange, onCheckIn }) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-600">Lịch hẹn</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">{verification.appointment?.appointmentCode}</h2>
        </div>
        <span className="w-fit rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{verification.appointment?.status}</span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <InfoCard label="Phòng khám" value={verification.department?.name || 'N/A'} />
        <InfoCard label="Bác sĩ" value={verification.doctor?.fullName || 'Bác sĩ bất kỳ'} />
        <InfoCard label="Ngày khám" value={verification.appointment?.scheduledAt ? new Date(verification.appointment.scheduledAt).toLocaleDateString('vi-VN') : 'N/A'} />
        <InfoCard label="Giờ khám" value={verification.appointment?.scheduledAt ? new Date(verification.appointment.scheduledAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'N/A'} />
      </div>

      <div className="mt-5 grid gap-3">
        <label htmlFor="appointment-reason" className="text-xs font-black uppercase tracking-wider text-slate-500">Lý do khám</label>
        <input id="appointment-reason" value={reason} onChange={(event) => onReasonChange(event.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-50" />
        <label htmlFor="appointment-symptoms" className="text-xs font-black uppercase tracking-wider text-slate-500">Triệu chứng ghi nhận</label>
        <textarea id="appointment-symptoms" value={symptoms} onChange={(event) => onSymptomsChange(event.target.value)} rows={3} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-50" />
      </div>

      <button type="button" disabled={busy} onClick={onCheckIn} className="mt-5 w-full rounded-xl bg-cyan-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50">
        {busy ? 'Đang check-in...' : 'Xác nhận check-in và tạo lượt khám'}
      </button>
    </section>
  );
}

function InfoCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}

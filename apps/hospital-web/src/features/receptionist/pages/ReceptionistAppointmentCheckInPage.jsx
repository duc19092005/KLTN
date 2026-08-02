import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import { useAuth } from '../../../providers/AuthProvider';
import { useToast } from '../../../providers/ToastProvider';
import { FRONTDESK_NAV_ITEMS, frontdeskRouteFor } from '../constants/frontdeskNavigation';
import { appointmentService } from '../apis/appointmentService';
import { QrCode, Camera, CheckCircle2, AlertCircle, Calendar, User, Building2, Stethoscope, ArrowRight } from 'lucide-react';

export default function ReceptionistAppointmentCheckInPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [qrPayload, setQrPayload] = useState('');
  const [verification, setVerification] = useState(null);
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
          // Retry
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
      const data = await appointmentService.checkIn(qrPayload.trim());
      toast.success(`Check-in thành công. Đã tạo lượt khám ${data?.visit?.visitCode || ''}`);
      navigate('/receptionist/queue');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Không check-in được lịch hẹn.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardLayout
      user={user}
      navItems={FRONTDESK_NAV_ITEMS}
      activeItem="appointment-checkin"
      onNavigate={(id) => navigate(frontdeskRouteFor(id))}
      onLogout={logout}
    >
      <div className="mx-auto max-w-[1600px] space-y-6 antialiased pb-12">
        {/* HERO BANNER */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-sky-50/80 blur-2xl pointer-events-none" />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-lg shadow-sky-600/25 shrink-0">
                <QrCode className="w-6 h-6" strokeWidth={2} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-sky-600 bg-sky-50 px-2.5 py-0.5 rounded-md border border-sky-100">
                    Phân hệ Lễ tân
                  </span>
                  <span className="text-xs font-semibold text-slate-400">• Quét mã check-in</span>
                </div>
                <h1 className="mt-1 text-2xl font-bold text-slate-900 tracking-tight">
                  Tiếp nhận lịch hẹn đăng ký trước
                </h1>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('/receptionist/queue')}
              className="w-fit rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
            >
              Xem danh sách hàng đợi
            </button>
          </div>
        </section>

        {/* SCANNER & STATUS GRID */}
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.25fr)_360px] items-start">
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

        {/* VERIFIED DETAILS PANEL */}
        {verification && (
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr] items-start">
            <PatientCard patient={verification.patient} />
            <AppointmentCard
              verification={verification}
              busy={busy}
              onCheckIn={checkIn}
            />
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}

function ScannerPanel({ qrPayload, setQrPayload, busy, scannerActive, scannerError, videoRef, canvasRef, onStart, onStop, onVerify }) {
  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-sky-600">Camera máy quét</p>
          <h2 className="text-base font-bold text-slate-900">Quét mã QR lịch hẹn khám</h2>
        </div>
        <button
          type="button"
          onClick={scannerActive ? onStop : onStart}
          className={`min-h-[42px] rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-sm transition-all flex items-center justify-center gap-2 ${
            scannerActive ? 'bg-rose-600 hover:bg-rose-700' : 'bg-sky-600 hover:bg-sky-700'
          }`}
        >
          <Camera className="w-4 h-4" />
          <span>{scannerActive ? 'Dừng camera' : 'Mở camera quét QR'}</span>
        </button>
      </div>

      {/* CAMERA SCREEN */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          {scannerActive ? (
            <div className="relative aspect-[16/9] w-full bg-slate-950">
              <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
              <div className="pointer-events-none absolute inset-0 grid place-items-center bg-slate-950/20">
                <div className="relative h-48 w-48 rounded-3xl border-2 border-white/80 shadow-[0_0_0_999px_rgba(15,23,42,0.3)]">
                  <span className="absolute -left-1 -top-1 h-9 w-9 rounded-tl-3xl border-l-[5px] border-t-[5px] border-sky-400" />
                  <span className="absolute -right-1 -top-1 h-9 w-9 rounded-tr-3xl border-r-[5px] border-t-[5px] border-sky-400" />
                  <span className="absolute -bottom-1 -left-1 h-9 w-9 rounded-bl-3xl border-b-[5px] border-l-[5px] border-sky-400" />
                  <span className="absolute -bottom-1 -right-1 h-9 w-9 rounded-br-3xl border-b-[5px] border-r-[5px] border-sky-400" />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid min-h-[240px] place-items-center bg-[radial-gradient(circle_at_top,_#ecfeff,_#f8fafc_60%)] p-8 text-center">
              <div>
                <div className="mx-auto w-14 h-14 rounded-2xl bg-white text-sky-700 flex items-center justify-center text-lg font-bold shadow-xs border border-sky-100 mb-3">
                  <QrCode className="w-7 h-7 stroke-[1.75]" />
                </div>
                <p className="text-sm font-bold text-slate-900">Sẵn sàng quét mã lịch hẹn</p>
                <p className="text-xs font-medium text-slate-400 mt-1">Bấm “Mở camera quét QR” hoặc nhập/dán mã bên dưới.</p>
              </div>
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>
      </div>

      {scannerError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>{scannerError}</span>
        </div>
      )}

      {/* MANUAL INPUT */}
      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 space-y-2">
        <label htmlFor="appointment-qr-payload" className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
          Nhập hoặc dán mã QR thủ công
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="appointment-qr-payload"
            value={qrPayload}
            onChange={(event) => setQrPayload(event.target.value)}
            placeholder="Dán mã payload QR..."
            className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          />
          <button
            type="button"
            disabled={busy || !qrPayload.trim()}
            onClick={onVerify}
            className="h-11 rounded-xl bg-sky-600 px-6 text-xs font-bold text-white shadow-xs hover:bg-sky-700 disabled:opacity-60 transition-colors whitespace-nowrap"
          >
            {busy ? 'Đang xác minh...' : 'Xác minh mã'}
          </button>
        </div>
      </div>
    </section>
  );
}

function StatusPanel({ error, verification }) {
  const tone = error ? 'rose' : verification ? 'emerald' : 'slate';
  const title = error || (verification ? 'Mã QR hợp lệ' : 'Chưa xác minh');
  const desc = error
    ? 'Vui lòng kiểm tra lại mã QR hoặc trạng thái lịch hẹn.'
    : verification
    ? 'Thông tin lịch hẹn đã sẵn sàng để check-in.'
    : 'Quét hoặc dán mã QR để bắt đầu xác minh.';

  return (
    <aside className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-5">
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-sky-600">Trạng thái xử lý</p>
        <h2 className="text-base font-bold text-slate-900">Kết quả xác minh QR</h2>
      </div>

      <div
        className={`rounded-2xl border p-4 transition-all ${
          tone === 'rose'
            ? 'border-rose-200 bg-rose-50/80'
            : tone === 'emerald'
            ? 'border-emerald-200 bg-emerald-50/80'
            : 'border-slate-200 bg-slate-50/60'
        }`}
      >
        <p className={`text-xs font-bold ${tone === 'rose' ? 'text-rose-800' : tone === 'emerald' ? 'text-emerald-800' : 'text-slate-800'}`}>
          {title}
        </p>
        <p className="mt-1 text-[11px] font-medium text-slate-500">{desc}</p>
      </div>

      <div className="space-y-2.5 text-xs font-semibold text-slate-600">
        <Step no="1" label="Quét/Dán mã QR lịch hẹn" done={Boolean(error || verification)} />
        <Step no="2" label="Xác minh thông tin bệnh nhân" done={Boolean(verification)} />
        <Step no="3" label="Check-in và tạo lượt khám" done={false} />
      </div>
    </aside>
  );
}

function Step({ no, label, done }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
      <span
        className={`grid h-6 w-6 place-items-center rounded-lg text-[11px] font-black ${
          done ? 'bg-sky-600 text-white' : 'bg-white text-slate-400 border border-slate-200'
        }`}
      >
        {no}
      </span>
      <span className="text-xs font-bold text-slate-700">{label}</span>
    </div>
  );
}

function PatientCard({ patient }) {
  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-4">
      <p className="text-[10px] font-extrabold uppercase tracking-widest text-sky-600">Bệnh nhân</p>
      <div className="flex items-center gap-3.5">
        <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-700 font-bold text-sm flex items-center justify-center border border-sky-200 shrink-0">
          {patient?.fullName?.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-base font-bold text-slate-900">{patient?.fullName}</h2>
          <p className="text-xs font-bold text-sky-600">Mã BN: {patient?.patientCode}</p>
        </div>
      </div>

      <div className="space-y-2 rounded-2xl bg-slate-50/80 border border-slate-100 p-4 text-xs font-medium text-slate-600">
        <p><span className="text-slate-400">Ngày sinh:</span> <strong className="text-slate-900">{patient?.birthDate ? new Date(patient.birthDate).toLocaleDateString('vi-VN') : 'N/A'}</strong></p>
        <p><span className="text-slate-400">Số CCCD:</span> <strong className="text-slate-900">{patient?.citizenId || 'Chưa có'}</strong></p>
        <p><span className="text-slate-400">Số điện thoại:</span> <strong className="text-slate-900">{patient?.contactPhone || patient?.phone || 'Chưa có'}</strong></p>
      </div>
    </section>
  );
}

function AppointmentCard({ verification, busy, onCheckIn }) {
  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-sky-600">Thông tin lịch hẹn</p>
          <h2 className="text-lg font-bold text-slate-900">{verification.appointment?.appointmentCode}</h2>
        </div>
        <span className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
          {verification.appointment?.status}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <InfoCard label="Phòng khám" value={verification.department?.name || 'N/A'} />
        <InfoCard label="Bác sĩ phụ trách" value={verification.doctor?.fullName || 'Bác sĩ bất kỳ'} />
        <InfoCard label="Ngày đăng ký khám" value={verification.appointment?.scheduledAt ? new Date(verification.appointment.scheduledAt).toLocaleDateString('vi-VN') : 'N/A'} />
        <InfoCard label="Giờ đăng ký khám" value={verification.appointment?.scheduledAt ? new Date(verification.appointment.scheduledAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'N/A'} />
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={onCheckIn}
        className="w-full rounded-xl bg-sky-600 px-6 py-3 text-xs font-bold text-white shadow-sm transition-all hover:bg-sky-700 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {busy ? 'Đang thực hiện Check-in...' : (
          <>
            <span>Xác nhận Check-in & Tạo lượt khám</span>
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </section>
  );
}

function InfoCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4">
      <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-0.5 break-words text-xs font-bold text-slate-900">{value}</p>
    </div>
  );
}

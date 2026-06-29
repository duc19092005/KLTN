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
    setBusy(true);
    setError('');
    try {
      const data = await appointmentService.verifyQr((payloadOverride || qrPayload).trim());
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
      <div className="mx-auto max-w-6xl space-y-5">
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-600">Check-in QR</p>
          <h1 className="mt-1 text-2xl font-black text-slate-950">Tiếp nhận lịch hẹn</h1>
        </section>

        <section className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_380px]">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">Máy quét QR</p>
              <button type="button" onClick={scannerActive ? stopScanner : startScanner} className={`rounded-xl px-4 py-2.5 text-xs font-black text-white shadow-sm transition ${scannerActive ? 'bg-rose-600 hover:bg-rose-700' : 'bg-cyan-600 hover:bg-cyan-700'}`}>
                {scannerActive ? 'Dừng' : 'Mở camera'}
              </button>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-slate-950">
              {scannerActive ? (
                <div className="relative aspect-video w-full">
                  <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
                  <div className="pointer-events-none absolute inset-0 grid place-items-center bg-slate-950/10">
                    <div className="h-44 w-44 rounded-3xl border-4 border-cyan-300 shadow-[0_0_0_999px_rgba(15,23,42,0.25)]" />
                  </div>
                </div>
              ) : (
                <div className="grid min-h-[220px] place-items-center text-sm font-black text-white">Camera chưa bật</div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>
            {scannerError ? <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">{scannerError}</div> : null}


          </div>

          <aside className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wider text-slate-500">Trạng thái</p>
            <div className={`mt-4 rounded-xl p-4 ${error ? 'bg-rose-50' : 'bg-slate-50'}`}>
              <p className={`text-sm font-black ${error ? 'text-rose-700' : 'text-slate-900'}`}>{error || (verification ? 'QR hợp lệ' : 'Chưa xác minh')}</p>
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

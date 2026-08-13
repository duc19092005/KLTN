import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import {
  AlertCircle,
  Check,
  Copy,
  Info,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  Lock,
  Wallet,
  KeyRound,
  UserCheck,
} from 'lucide-react';
import { authService } from '../apis/authService';
import { useAuth } from '../../../providers/AuthProvider';
import FaceCapture from '../components/FaceCapture';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { getDashboardRoute } from '../../../shared/constants/roleRoutes';

export default function AuthenticatePage() {
  const navigate = useNavigate();
  const { user, updateSession } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isFirstLogin = Boolean(user?.firstLogin || user?.isFirstLogin);
  const initialStep = isAdmin ? Math.min(Math.max(user?.registrationStep || 1, 1), 3) : 1;

  const [step, setStep] = useState(isFirstLogin ? initialStep : 4);
  const [status, setStatus] = useState('');
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState('');
  const [copied, setCopied] = useState(false);
  const [faceAttempt, setFaceAttempt] = useState(0);
  const [recoveryMode, setRecoveryMode] = useState(
    Boolean(isAdmin && !isFirstLogin && !user?.hasFace),
  );

  const resetFaceCapture = () => {
    setStatus('');
    setIsError(false);
    setFaceAttempt((n) => n + 1);
  };

  useEffect(() => {
    const nextInitial = isAdmin ? Math.min(Math.max(user?.registrationStep || 1, 1), 3) : 1;
    setStep(isFirstLogin ? nextInitial : 4);
    setRecoveryMode(Boolean(isAdmin && !isFirstLogin && !user?.hasFace));
  }, [isFirstLogin, isAdmin, user?.hasFace, user?.registrationStep]);

  const showStatus = (msg, error = false) => { setStatus(msg); setIsError(error); };
  const goDashboard = (targetUser = user) => navigate(getDashboardRoute(targetUser?.role), { replace: true });

  const registerFace = async (embedding) => {
    setBusy(true);
    showStatus('Đang mã hóa và lưu trữ tệp tin khuôn mặt sinh trắc...');
    try {
      await authService.registerFace(embedding);
      if (!isAdmin) {
        updateSession({ registrationStep: 2, hasFace: true });
        showStatus('Đăng ký khuôn mặt thành công. Vui lòng đặt mật khẩu mới để hoàn tất kích hoạt.');
        navigate('/change-password', { replace: true });
      } else {
        updateSession({ registrationStep: 2, hasFace: true });
        setStep(2);
        showStatus('Đăng ký khuôn mặt thành công. Vui lòng tiếp tục liên kết ví mật mã.');
      }
    } catch (err) {
      showStatus(err.response?.data?.message || err.message || 'Đăng ký khuôn mặt thất bại.', true);
    } finally {
      setBusy(false);
    }
  };

  const restoreAdminFace = async (embedding) => {
    setBusy(true);
    showStatus('Đang kiểm tra artifact IPFS và mốc toàn vẹn blockchain...');
    try {
      const challengeRes = await authService.adminFaceRecoveryChallenge();
      const result = await authService.adminFaceRecoveryRestore(embedding, challengeRes.data.challenge);
      const verifiedUser = result.data.user || { ...user, hasFace: true, verified: true };
      updateSession(verifiedUser);
      showStatus('Đã phục hồi dữ liệu khuôn mặt Admin và vô hiệu hóa các phiên cũ.');
      goDashboard(verifiedUser);
    } catch (err) {
      showStatus(err.response?.data?.message || err.message || 'Phục hồi dữ liệu thất bại.', true);
    } finally {
      setBusy(false);
    }
  };

  const bindWallet = async () => {
    setBusy(true);
    showStatus('Đang khởi tạo chữ ký yêu cầu xác thực trên chuỗi...');
    try {
      if (!window.ethereum) throw new Error('Không tìm thấy tiện ích MetaMask trên trình duyệt của bạn.');
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const challenge = await authService.walletBindChallenge(address);
      const message = challenge.data.message;
      const signature = await signer.signMessage(message);
      const result = await authService.verifyWallet(address, signature, message);
      
      // Automatically complete activation in background without manual ZKP step
      showStatus('Đang tự động hoàn tất kích hoạt tài khoản quản trị...');
      const mfaRes = await authService.generateMfaSecret();
      const activatedUser = mfaRes.data.user || result.data.user || { walletAddress: address, firstLogin: false, verified: true };
      updateSession(activatedUser);
      showStatus('Xác thực ví & kích hoạt tài khoản quản trị thành công!');
      goDashboard(activatedUser);
    } catch (err) {
      showStatus(err.response?.data?.message || err.message || 'Liên kết ví thất bại.', true);
    } finally {
      setBusy(false);
    }
  };

  const verifyFaceLogin = async (embedding) => {
    setBusy(true);
    showStatus('Đang đối chiếu dữ liệu khuôn mặt với hệ thống...');
    try {
      const challengeRes = await authService.faceChallenge();
      const challenge = challengeRes.data.challenge;
      const result = await authService.verifyFace(embedding, challenge);
      const verifiedUser = result.data.user || { ...user, verified: true };
      updateSession(verifiedUser);
      goDashboard(verifiedUser);
    } catch (err) {
      if (isAdmin && err.response?.data?.code === 'FACE_TEMPLATE_TAMPERED') {
        setRecoveryMode(true);
        showStatus('Dữ liệu khuôn mặt trong cơ sở dữ liệu không còn toàn vẹn. Hãy quét lại để phục hồi từ bản IPFS đã được blockchain xác thực.', true);
      } else {
        showStatus(err.response?.data?.message || err.message || 'Xác thực khuôn mặt thất bại.', true);
      }
    } finally {
      setBusy(false);
    }
  };

  const stepsLayout = isAdmin
    ? [
        { label: 'Sinh trắc học', desc: 'Quét khuôn mặt' },
        { label: 'Liên kết ví', desc: 'Ghi danh trên chuỗi' },
        { label: 'Hoàn tất', desc: 'Sẵn sàng làm việc' },
      ]
    : [
        { label: 'Sinh trắc học', desc: 'Đăng ký khuôn mặt' },
        { label: 'Hoàn tất', desc: 'Xác thực đăng nhập' },
      ];

  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-slate-100 font-sans antialiased p-4 sm:p-6 lg:p-8 selection:bg-sky-100 selection:text-sky-700">
      <section className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden transition-all duration-300">
        
        {/* Top Bright Medical Header Hero */}
        <div className="relative overflow-hidden bg-gradient-to-br from-sky-50/90 via-white to-cyan-50/70 p-7 sm:p-9 text-slate-900 border-b border-sky-100">
          {/* Decorative Soft Glow */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-sky-200/30 blur-3xl" />
          <div className="pointer-events-none absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-cyan-200/25 blur-2xl" />

          <div className="relative z-10 space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-100/80 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-sky-800 shadow-2xs">
              <Sparkles className="h-3.5 w-3.5 text-sky-600" />
              <span>Bệnh Viện Đa Khoa Quốc Tế KLTN · Cổng Xác Thực</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              {isFirstLogin
                ? (isAdmin ? 'Kích hoạt Tài khoản Quản trị' : 'Kích hoạt Tài khoản Nhân sự')
                : 'Xác thực Sinh trắc học (MFA)'}
            </h1>

            <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed max-w-lg">
              {isFirstLogin
                ? (isAdmin
                    ? 'Quản trị viên cần hoàn tất thiết lập sinh trắc học và liên kết ví MetaMask.'
                    : 'Vui lòng hoàn tất đăng ký khuôn mặt để hoàn tất quy trình kích hoạt tài khoản.')
                : 'Vui lòng quét camera khuôn mặt sống để xác minh quyền truy cập hệ thống y tế.'}
            </p>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-6 sm:p-9 space-y-6">
          {isFirstLogin && <Stepper steps={stepsLayout} step={step} secret={secret} />}

          {status && <StatusBox status={status} isError={isError} busy={busy} onRetry={resetFaceCapture} />}

          {/* Action / Camera Container */}
          <div className="bg-slate-50/70 border border-slate-200/80 rounded-3xl p-5 sm:p-7 min-h-[240px] flex flex-col justify-center items-center shadow-inner">
            {isFirstLogin && step === 1 && (
              <div className="w-full max-w-md animate-in fade-in duration-300">
                <FaceCapture
                  key={faceAttempt}
                  onCapture={registerFace}
                  onError={(msg) => showStatus(msg, true)}
                  disabled={busy}
                  label="Quét khuôn mặt thành viên"
                  captureMode="enroll"
                />
              </div>
            )}

            {isAdmin && isFirstLogin && step === 2 && (
              <ActionPanel
                icon={Wallet}
                title="Xác thực Quyền hạn Trên Chuỗi"
                desc="Liên kết địa chỉ ví mật mã MetaMask làm định danh bất biến trên Sepolia Ethereum Testnet."
                button="Kết nối MetaMask & Xác nhận"
                onClick={bindWallet}
                busy={busy}
                id="bind-wallet-button"
              />
            )}

            {!isFirstLogin && !recoveryMode && (
              <div className="w-full max-w-md animate-in fade-in duration-300">
                <FaceCapture
                  key={faceAttempt}
                  onCapture={verifyFaceLogin}
                  onError={(msg) => showStatus(msg, true)}
                  disabled={busy}
                  label="Xác thực sinh trắc học"
                />
              </div>
            )}

            {!isFirstLogin && recoveryMode && isAdmin && (
              <div className="w-full max-w-md animate-in fade-in duration-300 space-y-4">
                <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-left text-amber-900 shadow-xs">
                  <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <p className="text-xs font-semibold leading-relaxed">
                    Phiên ví Admin sẽ dùng khuôn mặt sống để mở bản mã hóa IPFS và khôi phục embedding gốc.
                  </p>
                </div>
                <FaceCapture
                  key={faceAttempt}
                  onCapture={restoreAdminFace}
                  onError={(msg) => showStatus(msg, true)}
                  disabled={busy}
                  label="Quét để phục hồi khuôn mặt Admin"
                />
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function Stepper({ steps, step }) {
  return (
    <div className="mb-6">
      <div className="grid grid-cols-2 gap-4 sm:flex sm:items-center sm:justify-between relative">
        {steps.map((s, idx) => {
          const currentIdx = idx + 1;
          const isCompleted = step > currentIdx;
          const isActive = step === currentIdx;
          return (
            <div key={s.label} className="flex items-center gap-3 sm:flex-1 last:flex-none">
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-2xl font-black text-xs flex items-center justify-center border shrink-0 transition-all duration-300 shadow-xs ${
                    isCompleted
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-emerald-600/20'
                      : isActive
                      ? 'bg-sky-50 border-sky-500 text-sky-700 ring-4 ring-sky-100'
                      : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}
                >
                  {isCompleted ? <Check className="h-4 w-4 stroke-[3]" /> : currentIdx}
                </div>
                <div className="text-left">
                  <p className={`text-xs font-bold leading-tight ${isActive || isCompleted ? 'text-slate-900' : 'text-slate-400'}`}>
                    {s.label}
                  </p>
                  <p className="text-[10px] text-slate-400 font-semibold hidden sm:block mt-0.5">{s.desc}</p>
                </div>
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`hidden sm:block flex-1 h-[2px] mx-3 transition-colors duration-300 ${
                    step > currentIdx ? 'bg-emerald-500' : 'bg-slate-200'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusBox({ status, isError, busy, onRetry }) {
  return (
    <div
      className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200 shadow-xs ${
        isError
          ? 'bg-rose-50 border-rose-200 text-rose-800'
          : 'bg-sky-50/70 border-sky-200 text-sky-900'
      }`}
    >
      <div className="flex items-start gap-3">
        {busy && !isError ? (
          <LoadingIndicator size="sm" tone="cyan" className="mt-0.5 shrink-0" />
        ) : isError ? (
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
        ) : (
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
        )}
        <p className="text-xs sm:text-sm font-bold leading-relaxed">{status}</p>
      </div>

      {isError && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2 transition shadow-sm flex items-center justify-center gap-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Quét lại khuôn mặt</span>
        </button>
      )}
    </div>
  );
}

function ActionPanel({ icon: Icon = ShieldCheck, title, desc, button, onClick, busy, id }) {
  return (
    <div className="text-center max-w-md py-6 space-y-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 mx-auto border border-sky-100 shadow-xs">
        <Icon className="h-7 w-7" />
      </div>
      <div>
        <h3 className="text-base font-extrabold text-slate-900">{title}</h3>
        <p className="mt-1 text-xs text-slate-500 font-medium leading-relaxed">{desc}</p>
      </div>
      <button
        id={id}
        type="button"
        onClick={onClick}
        disabled={busy}
        className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-3.5 px-6 rounded-2xl disabled:opacity-50 transition shadow-md shadow-sky-600/25 flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
      >
        <span>{button}</span>
      </button>
    </div>
  );
}

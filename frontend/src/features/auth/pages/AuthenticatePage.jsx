import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import { AlertCircle, Check, Copy, Info } from 'lucide-react';
import { authService } from '../apis/authService';
import { useAuth } from '../../../providers/AuthProvider';
import FaceCapture from '../components/FaceCapture';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { getDashboardRoute } from '../../../shared/constants/roleRoutes';
import { stepUpSession } from '../../../shared/stepup/sessionStore';

export default function AuthenticatePage() {
  const navigate = useNavigate();
  const { user, updateSession } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isFirstLogin = Boolean(user?.firstLogin || user?.isFirstLogin || !user?.hasFace);
  const initialStep = isAdmin ? Math.min(Math.max(user?.registrationStep || 1, 1), 3) : 1;
  const [step, setStep] = useState(isFirstLogin ? initialStep : 4);
  const [status, setStatus] = useState('');
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const nextInitial = isAdmin ? Math.min(Math.max(user?.registrationStep || 1, 1), 3) : 1;
    setStep(isFirstLogin ? nextInitial : 4);
  }, [isFirstLogin, isAdmin, user?.registrationStep]);

  const showStatus = (msg, error = false) => { setStatus(msg); setIsError(error); };
  const goDashboard = (targetUser = user) => navigate(getDashboardRoute(targetUser?.role), { replace: true });

  const registerFace = async (embedding) => {
    setBusy(true); showStatus('Đang mã hóa và lưu trữ tệp tin khuôn mặt...');
    try {
      await authService.registerFace(embedding);
      if (!isAdmin) {
        // Non-admin first-login order: face registered → set permanent password → face-verify-login.
        // Keep firstLogin=true locally so the change-password screen is correctly required; backend
        // will flip it to false once the new password is committed.
        updateSession({ registrationStep: 2, hasFace: true });
        showStatus('Đăng ký khuôn mặt thành công. Vui lòng đặt mật khẩu mới để hoàn tất kích hoạt.');
        navigate('/change-password', { replace: true });
      } else {
        // Onboarding admin còn nhiều bước (liên kết ví -> ZKP). Phải giữ firstLogin=true cho tới khi
        // backend hoàn tất generateMfaSecret, nếu không trang sẽ rơi vào bước xác thực đăng nhập sớm.
        updateSession({ registrationStep: 2, hasFace: true });
        setStep(2); showStatus('Đăng ký khuôn mặt thành công. Vui lòng tiếp tục liên kết ví.');
      }
    } catch (err) { showStatus(err.response?.data?.message || err.message, true); }
    finally { setBusy(false); }
  };

  const bindWallet = async () => {
    setBusy(true); showStatus('Đang khởi tạo chữ ký yêu cầu xác thực trên chuỗi...');
    try {
      if (!window.ethereum) throw new Error('Không tìm thấy tiện ích MetaMask trên trình duyệt của bạn.');
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const challenge = await authService.walletBindChallenge(address);
      const message = challenge.data.message;
      const signature = await signer.signMessage(message);
      const result = await authService.verifyWallet(address, signature, message);
      updateSession(result.data.user || { walletAddress: address, registrationStep: 3 });
      setStep(3); showStatus('Ví quản trị đã được xác thực thành công trên blockchain.');
    } catch (err) { showStatus(err.response?.data?.message || err.message, true); }
    finally { setBusy(false); }
  };

  const generateZkpIdentity = async () => {
    setBusy(true); showStatus('Hệ thống đang thiết lập bằng chứng mật mã ZKP...');
    try {
      const result = await authService.generateMfaSecret();
      setSecret(result.data.secret);
      updateSession(result.data.user || { firstLogin: false, registrationStep: 4, verified: true });
      showStatus('Định danh mã hóa thành công. Vui lòng lưu trữ khóa khôi phục bí mật.');
    } catch (err) { showStatus(err.response?.data?.message || err.message, true); }
    finally { setBusy(false); }
  };

  const verifyFaceLogin = async (embedding) => {
    setBusy(true); showStatus('Đang thực hiện kiểm tra thực thể sống...');
    try {
      const challengeRes = await authService.faceChallenge();
      const challenge = challengeRes.data.challenge;
      const result = await authService.verifyFace(embedding, challenge);
      const verifiedUser = result.data.user || { ...user, verified: true };
      // Login already proved a live face match; the backend opens a step-up privilege session from
      // that same proof. Seed the in-memory store so the dashboard starts in "sudo mode" and the
      // user is not asked to scan again for the first sensitive action.
      const session = result.data.stepUpSession;
      if (session?.session) {
        stepUpSession.setSession(session.session, {
          idleExpiresAt: session.idleExpiresAt,
          absoluteExpiresAt: session.absoluteExpiresAt,
        });
      }
      updateSession(verifiedUser);
      goDashboard(verifiedUser);
    } catch (err) { showStatus(err.response?.data?.message || err.message, true); }
    finally { setBusy(false); }
  };

  const handleCopySecret = () => { navigator.clipboard.writeText(secret); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const stepsLayout = isAdmin
    ? [{ label: 'Sinh trắc học', desc: 'Quét khuôn mặt' }, { label: 'Liên kết ví', desc: 'Ghi danh trên chuỗi' }, { label: 'Mật mã ZKP', desc: 'Khởi tạo bảo mật' }, { label: 'Hoàn tất', desc: 'Sẵn sàng làm việc' }]
    : [{ label: 'Sinh trắc học', desc: 'Đăng ký khuôn mặt' }, { label: 'Hoàn tất', desc: 'Xác thực đăng nhập' }];

  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-[#F4F7FA] font-sans antialiased p-4 sm:p-6 lg:p-8 selection:bg-cyan-100 selection:text-cyan-700">
      <section className="w-full max-w-2xl bg-white rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.03)] border border-slate-200/80 p-6 sm:p-10 transition-colors">
        <div className="border-b border-slate-100 pb-6 mb-8">
          <p className="text-[10px] font-bold text-cyan-600 uppercase tracking-widest mb-1">{isFirstLogin ? 'Luồng kích hoạt tài khoản' : 'Xác thực MFA'}</p>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{isFirstLogin ? (isAdmin ? 'Kích hoạt tài khoản quản trị' : 'Kích hoạt tài khoản nhân sự') : 'Xác thực khuôn mặt'}</h1>
          <p className="text-sm text-slate-500 mt-1 leading-relaxed">{isFirstLogin ? (isAdmin ? 'Quản trị viên cần thiết lập sinh trắc học, ví và ZKP.' : 'Vui lòng đăng ký khuôn mặt để hoàn tất kích hoạt tài khoản.') : 'Vui lòng quét camera để xác minh quyền truy cập.'}</p>
        </div>

        {isFirstLogin && <Stepper steps={stepsLayout} step={step} secret={secret} />}
        {status && <StatusBox status={status} isError={isError} busy={busy} />}

        <div className="bg-slate-50/50 border border-slate-200/60 rounded-2xl p-4 sm:p-6 min-h-[220px] flex flex-col justify-center items-center">
          {isFirstLogin && step === 1 && <div className="w-full max-w-sm animate-in fade-in-50 duration-300"><FaceCapture onCapture={registerFace} disabled={busy} label="Quét khuôn mặt thành viên" captureMode="enroll" /></div>}
          {isAdmin && isFirstLogin && step === 2 && <ActionPanel title="Xác thực quyền hạn trên chuỗi" desc="Liên kết địa chỉ ví mật mã làm định danh bất biến." button="Kết nối MetaMask & Xác nhận" onClick={bindWallet} busy={busy} id="bind-wallet-button" />}
          {isAdmin && isFirstLogin && step === 3 && !secret && <ActionPanel title="Tạo lập bằng chứng Zero-Knowledge" desc="Mã hóa thông tin nội bộ thành biểu thức toán học bảo mật." button="Khởi tạo định danh ZKP" onClick={generateZkpIdentity} busy={busy} id="generate-zkp-button" />}
          {secret && <SecretPanel secret={secret} copied={copied} onCopy={handleCopySecret} onDone={() => goDashboard({ ...user, role: 'ADMIN' })} />}
          {!isFirstLogin && !secret && <div className="w-full max-w-sm animate-in fade-in duration-300"><FaceCapture onCapture={verifyFaceLogin} disabled={busy} label="Xác thực sinh trắc học" /></div>}
        </div>
      </section>
    </main>
  );
}

function Stepper({ steps, step, secret }) {
  return <div className="mb-10 block"><div className="grid grid-cols-2 gap-4 sm:flex sm:items-center sm:justify-between relative">{steps.map((s, idx) => { const currentIdx = idx + 1; const isCompleted = step > currentIdx || secret; const isActive = step === currentIdx && !secret; return <div key={s.label} className="flex items-center gap-3 sm:flex-1 last:flex-none"><div className="flex items-center gap-2.5"><div className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center border shrink-0 transition-colors duration-300 ${isCompleted ? 'bg-cyan-600 border-cyan-600 text-white shadow-sm' : ''} ${isActive ? 'bg-cyan-50 border-cyan-400 text-cyan-600 ring-4 ring-cyan-50' : ''} ${!isActive && !isCompleted ? 'bg-slate-50 border-slate-200 text-slate-400' : ''}`}>{isCompleted ? <Check className="h-4 w-4" /> : currentIdx}</div><div className="text-left"><p className={`text-xs font-bold leading-tight ${isActive || isCompleted ? 'text-slate-900' : 'text-slate-400'}`}>{s.label}</p><p className="text-[10px] text-slate-400 font-medium hidden sm:block">{s.desc}</p></div></div>{idx < steps.length - 1 && <div className={`hidden sm:block flex-1 h-[2px] mx-4 transition-colors duration-300 ${step > currentIdx ? 'bg-cyan-200' : 'bg-slate-100'}`} />}</div>; })}</div></div>;
}
function StatusBox({ status, isError, busy }) { return <div className={`mb-6 p-4 rounded-xl border flex items-start gap-3 animate-in fade-in duration-200 ${isError ? 'bg-rose-50/80 border-rose-100 text-rose-700' : 'bg-cyan-50/50 border-cyan-100 text-cyan-800'}`}>{busy && !isError ? <LoadingIndicator size="sm" tone="cyan" className="mt-0.5" /> : isError ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <Info className="mt-0.5 h-4 w-4 shrink-0" />}<p className="text-sm font-medium leading-snug">{status}</p></div>; }
function ActionPanel({ title, desc, button, onClick, busy, id }) { return <div className="text-center max-w-sm py-4"><h3 className="text-sm font-bold text-slate-900 mb-1">{title}</h3><p className="text-xs text-slate-400 mb-6">{desc}</p><button id={id} type="button" onClick={onClick} disabled={busy} className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-2.5 px-4 rounded-xl disabled:opacity-50">{button}</button></div>; }
function SecretPanel({ secret, copied, onCopy, onDone }) { return <div className="ui-table w-full text-left"><div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-4"><h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-0.5">Cảnh báo bảo mật</h4><p className="text-xs text-amber-800 font-medium">Khóa này chỉ xuất hiện một lần. Hãy lưu trữ an toàn.</p></div><div className="relative bg-slate-900 text-slate-100 px-4 py-3 rounded-xl font-mono text-sm break-all pr-12"><code>{secret}</code><button type="button" onClick={onCopy} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg bg-slate-800 p-2 text-slate-300" aria-label="Sao chép khóa">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</button></div><button type="button" onClick={onDone} className="w-full mt-5 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-3 px-4 rounded-xl">Tôi đã lưu trữ an toàn, truy cập bảng làm việc</button></div>; }

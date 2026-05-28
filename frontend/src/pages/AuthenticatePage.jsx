import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import { authService } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';
import FaceCapture from '../components/FaceCapture';
import LoadingIndicator from '../components/LoadingIndicator';

export default function AuthenticatePage() {
  const navigate = useNavigate();
  const { user, updateSession } = useAuth();
  const isFirstLogin = Boolean(user?.firstLogin || user?.isFirstLogin);

  const [step, setStep] = useState(isFirstLogin ? Math.min(Math.max(user?.registrationStep || 1, 1), 3) : 4);
  const [status, setStatus] = useState('');
  const [isError, setIsError] = useState(false); // Tách biệt trạng thái lỗi để hiển thị màu chuẩn
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setStep(isFirstLogin ? Math.min(Math.max(user?.registrationStep || 1, 1), 3) : 4);
  }, [isFirstLogin, user?.registrationStep]);

  const showStatus = (msg, error = false) => {
    setStatus(msg);
    setIsError(error);
  };

  const registerFace = async (embedding) => {
    setBusy(true);
    showStatus('Đang mã hóa và lưu trữ tệp tin khuôn mặt...');
    try {
      await authService.registerFace(embedding);
      updateSession({ registrationStep: 2, hasFace: true });
      setStep(2);
      showStatus('Đăng ký khuôn mặt thành công. Vui lòng tiếp tục liên kết ví.');
    } catch (err) {
      showStatus(err.response?.data?.message || err.message, true);
    } finally {
      setBusy(false);
    }
  };

  const bindWallet = async () => {
    setBusy(true);
    showStatus('Đang khởi tạo chữ ký yêu cầu xác thực On-chain...');
    try {
      if (!window.ethereum) {
        throw new Error('Không tìm thấy tiện ích MetaMask trên trình duyệt của bạn.');
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const challenge = await authService.walletBindChallenge(address);
      const message = challenge.data.message;
      const signature = await signer.signMessage(message);
      const result = await authService.verifyWallet(address, signature, message);

      updateSession(result.data.user || { walletAddress: address, registrationStep: 3 });
      setStep(3);
      showStatus('Ví quản trị đã được xác thực thành công trên Blockchain.');
    } catch (err) {
      showStatus(err.response?.data?.message || err.message, true);
    } finally {
      setBusy(false);
    }
  };

  const generateZkpIdentity = async () => {
    setBusy(true);
    showStatus('Hệ thống đang thiết lập bằng chứng mật mã ZKP...');
    try {
      const result = await authService.generateMfaSecret();
      setSecret(result.data.secret);
      updateSession(result.data.user || { firstLogin: false, registrationStep: 4, verified: true });
      showStatus('Định danh mã hóa thành công. Vui lòng lưu trữ khóa khôi phục bí mật.');
    } catch (err) {
      showStatus(err.response?.data?.message || err.message, true);
    } finally {
      setBusy(false);
    }
  };

  const verifyFaceLogin = async (embedding) => {
    setBusy(true);
    showStatus('Đang thực hiện kiểm tra thực thể sống (Liveness check)...');
    try {
      const result = await authService.verifyFace(embedding);
      updateSession(result.data.user || { verified: true });
      navigate('/admin');
    } catch (err) {
      showStatus(err.response?.data?.message || err.message, true);
    } finally {
      setBusy(false);
    }
  };

  const handleCopySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const stepsLayout = [
    { label: 'Sinh trắc học', desc: 'Quét FaceID' },
    { label: 'Liên kết ví', desc: 'Ghi danh On-chain' },
    { label: 'Mật mã ZKP', desc: 'Khởi tạo bảo mật' },
    { label: 'Hoàn tất', desc: 'Sẵn sàng làm việc' }
  ];

  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-[#F4F7FA] font-sans antialiased p-4 sm:p-6 lg:p-8 selection:bg-blue-100 selection:text-blue-700">
      <section className="w-full max-w-2xl bg-white rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.03)] border border-slate-200/80 p-6 sm:p-10 transition-all">

        {/* Top Header */}
        <div className="border-b border-slate-100 pb-6 mb-8">
          <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">
            {isFirstLogin ? 'Onboarding Flow' : 'MFA Verification'}
          </p>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {isFirstLogin ? 'Kích Hoạt Tài Khoản Quản Trị' : 'Xác Thực Khuôn Mặt'}
          </h1>
          <p className="text-sm text-slate-500 mt-1 leading-relaxed">
            {isFirstLogin
              ? 'Hệ thống định danh yêu cầu thiết lập chuỗi bảo mật tuần tự gồm sinh trắc học và chữ ký số.'
              : 'Hệ thống đã nhận diện chữ ký ví hợp lệ. Vui lòng hoàn tất quét camera để xác minh quyền hạn truy cập.'}
          </p>
        </div>

        {/* STEPPER BAR (Chỉ hiện khi đăng nhập lần đầu) */}
        {isFirstLogin && (
          <div className="mb-10 block">
            <div className="grid grid-cols-2 gap-4 sm:flex sm:items-center sm:justify-between relative">
              {stepsLayout.map((s, idx) => {
                const currentIdx = idx + 1;
                const isCompleted = step > currentIdx || secret;
                const isActive = step === currentIdx && !secret;

                return (
                  <div key={s.label} className="flex items-center gap-3 sm:flex-1 last:flex-none">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center border shrink-0 transition-all duration-300
                        ${isCompleted ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-100' : ''}
                        ${isActive ? 'bg-blue-50 border-blue-400 text-blue-600 ring-4 ring-blue-50' : ''}
                        ${!isActive && !isCompleted ? 'bg-slate-50 border-slate-200 text-slate-400' : ''}
                      `}>
                        {isCompleted ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : currentIdx}
                      </div>
                      <div className="text-left">
                        <p className={`text-xs font-bold leading-tight ${isActive || isCompleted ? 'text-slate-900' : 'text-slate-400'}`}>{s.label}</p>
                        <p className="text-[10px] text-slate-400 font-medium hidden sm:block">{s.desc}</p>
                      </div>
                    </div>
                    {idx < stepsLayout.length - 1 && (
                      <div className={`hidden sm:block flex-1 h-[2px] mx-4 transition-colors duration-300 ${step > currentIdx ? 'bg-blue-200' : 'bg-slate-100'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STATUS BOX / NOTIFICATION CONTROLLER */}
        {status && (
          <div className={`mb-6 p-4 rounded-xl border flex items-start gap-3 animate-in fade-in duration-200
            ${isError
              ? 'bg-red-50/80 border-red-100 text-red-700'
              : 'bg-blue-50/50 border-blue-100 text-blue-800'
            }`}
          >
            {busy && !isError ? (
              <LoadingIndicator size="sm" tone="blue" className="mt-0.5" />
            ) : (
              <svg className={`w-5 h-5 shrink-0 mt-0.5 ${isError ? 'text-red-500' : 'text-blue-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                {isError
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                }
              </svg>
            )}
            <p className="text-sm font-medium leading-snug">{status}</p>
          </div>
        )}

        {/* CORE INTERACTIVE PANELS */}
        <div className="bg-slate-50/50 border border-slate-200/60 rounded-2xl p-4 sm:p-6 min-h-[220px] flex flex-col justify-center items-center">

          {/* LUỒNG 1: Đăng ký mặt */}
          {isFirstLogin && step === 1 && (
            <div className="w-full max-w-sm animate-in fade-in-50 duration-300">
              <FaceCapture onCapture={registerFace} disabled={busy} label="Quét Khuôn Mặt Thành Viên" captureMode="enroll" />
            </div>
          )}

          {/* LUỒNG 2: Kích hoạt liên kết Ví */}
          {isFirstLogin && step === 2 && (
            <div className="text-center max-w-sm py-4 animate-in slide-in-from-bottom-4 duration-300">
              <div className="w-12 h-12 bg-blue-50 border border-blue-200 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">Xác thực quyền hạn On-chain</h3>
              <p className="text-xs text-slate-400 mb-6">Hệ thống sẽ tiến hành liên kết địa chỉ ví mật mã làm định danh bất biến.</p>
              <button
                id="bind-wallet-button"
                type="button"
                onClick={bindWallet}
                disabled={busy}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-50 shadow-sm"
              >
                Kết nối MetaMask & Xác nhận
              </button>
            </div>
          )}

          {/* LUỒNG 3: Sinh mã bảo mật định danh ZKP */}
          {isFirstLogin && step === 3 && !secret && (
            <div className="text-center max-w-sm py-4 animate-in slide-in-from-bottom-4 duration-300">
              <div className="w-12 h-12 bg-blue-50 border border-blue-200 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">Tạo lập Zero-Knowledge Proofs</h3>
              <p className="text-xs text-slate-400 mb-6">Mã hóa thông tin nội bộ của bạn thành các biểu thức toán học bảo mật cao.</p>
              <button
                id="generate-zkp-button"
                type="button"
                onClick={generateZkpIdentity}
                disabled={busy}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-50 shadow-sm"
              >
                Khởi tạo Định danh ZKP
              </button>
            </div>
          )}

          {/* BẢO MẬT CAO: Hiển thị Khóa khôi phục mật khẩu (Secret Seed) */}
          {secret && (
            <div className="w-full animate-in zoom-in-95 duration-300 text-left">
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3 mb-4">
                <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-0.5">Cảnh báo bảo mật tối cao</h4>
                  <p className="text-xs text-amber-800 leading-normal font-medium">Bản sao lưu này chỉ xuất hiện duy nhất một lần. Mất khóa này đồng nghĩa với việc bạn sẽ mất vĩnh viễn quyền truy cập khôi phục tài khoản quản trị.</p>
                </div>
              </div>

              <div className="relative bg-slate-900 text-slate-100 px-4 py-3 rounded-xl font-mono text-sm break-all pr-12 border border-slate-800 shadow-inner">
                <code>{secret}</code>
                <button
                  type="button"
                  onClick={handleCopySecret}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                  title="Sao chép khóa"
                >
                  {copied ? (
                    <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={() => navigate('/admin')}
                className="w-full mt-5 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 px-4 rounded-xl transition-colors duration-200 text-center text-sm shadow-sm"
              >
                Tôi đã lưu trữ an toàn, Truy cập Dashboard
              </button>
            </div>
          )}

          {/* LUỒNG 4: Quét mặt kiểm tra thực thể sống lúc đăng nhập định kỳ */}
          {!isFirstLogin && (
            <div className="w-full max-w-sm animate-in fade-in duration-300">
              <FaceCapture onCapture={verifyFaceLogin} disabled={busy} label="Xác Thực Trắc Sinh Học Admin" />
            </div>
          )}

        </div>
      </section>
    </main>
  );
}
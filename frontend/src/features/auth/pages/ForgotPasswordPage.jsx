import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../apis/authService';
import FaceCapture from '../components/FaceCapture';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useToast } from '../../../providers/ToastProvider';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const toast = useToast();
  
  const [step, setStep] = useState(1); // 1: Username, 2: Face Scan, 3: Reset Password
  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState('');
  const [challenge, setChallenge] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleUsernameSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) return;

    setBusy(true);
    setStatus('Đang kiểm tra tài khoản...');
    try {
      const res = await authService.forgotPasswordChallenge(username.trim());
      setUserId(res.data.userId);
      setChallenge(res.data.challenge);
      setStep(2);
      setStatus('');
      toast.success('Xác nhận tài khoản thành công. Hãy chuẩn bị quét khuôn mặt.');
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Không thể xác thực tài khoản này.';
      setStatus('');
      toast.error(errMsg);
    } finally {
      setBusy(false);
    }
  };

  const handleFaceCapture = async (embedding) => {
    setBusy(true);
    setStatus('Đang xác thực khuôn mặt sinh trắc học...');
    try {
      const res = await authService.forgotPasswordVerifyFace(userId, embedding, challenge);
      setResetToken(res.data.resetToken);
      setStep(3);
      setStatus('');
      toast.success('Xác thực khuôn mặt thành công. Vui lòng thiết lập mật khẩu mới.');
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Xác thực khuôn mặt thất bại.';
      setStatus('');
      toast.error(errMsg);
      // Quay lại bước 1 nếu challenge hết hạn hoặc có lỗi nghiêm trọng
      setStep(1);
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('Mật khẩu mới phải chứa ít nhất 8 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Xác nhận mật khẩu mới không khớp.');
      return;
    }

    setBusy(true);
    setStatus('Đang đặt lại mật khẩu mới...');
    try {
      await authService.forgotPasswordReset(resetToken, newPassword);
      setStatus('');
      toast.success('Đặt lại mật khẩu thành công! Vui lòng đăng nhập lại.');
      navigate('/login', { replace: true });
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Không thể đặt lại mật khẩu.';
      setStatus('');
      toast.error(errMsg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#faf8ff] text-[#171b2b] antialiased relative">
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        
        .hms-forgot-portal {
          font-family: 'Plus Jakarta Sans', sans-serif;
          --primary-fixed: #dde1ff;
          --surface-container-lowest: #ffffff;
          --surface-bright: #faf8ff;
          --primary: #4656a2;
          --surface-container-highest: #dee1f8;
          --on-surface-variant: #454651;
        }
        
        .ambient-bg-login {
          background: radial-gradient(circle at top left, var(--surface-container-highest, #dee1f8), transparent 40%),
                      radial-gradient(circle at bottom right, var(--primary-fixed, #dde1ff), transparent 40%);
          background-color: #faf8ff;
        }

        .material-symbols-outlined {
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        .material-symbols-outlined.fill {
          font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
      `}} />

      <div className="hms-forgot-portal ambient-bg-login flex-grow flex flex-col justify-between min-h-screen">
        
        {/* Main Content Area: Centered Canvas */}
        <main className="flex-grow flex items-center justify-center px-6 py-12 relative z-10">
          
          {/* Form Card Container */}
          <div className="bg-[#ffffff] shadow-[0px_20px_40px_rgba(99,115,193,0.08)] rounded-2xl w-full max-w-[480px] p-8 md:p-10 relative overflow-hidden backdrop-blur-sm border border-[#e4e7fe]/50">
            
            {/* Brand Header */}
            <div className="text-center mb-8 flex flex-col items-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#dde1ff] text-[#4656a2] mb-4">
                <span className="material-symbols-outlined fill text-[28px]">lock_reset</span>
              </div>
              <h1 className="text-2xl font-bold text-[#4656a2] tracking-tight">Khôi Phục Mật Khẩu</h1>
              <p className="text-sm font-semibold text-[#454651] mt-2">Xác thực sinh trắc học an toàn</p>
            </div>

            {/* Stepper Indicator */}
            <div className="flex justify-between items-center mb-8 px-2">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step >= 1 ? 'bg-[#4656a2] text-white' : 'bg-slate-200 text-slate-500'
                }`}>
                  1
                </div>
                <span className={`text-xs font-bold ${step === 1 ? 'text-[#4656a2]' : 'text-slate-400'}`}>Tài khoản</span>
              </div>
              <div className="flex-grow h-[1px] bg-slate-200 mx-2"></div>
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step >= 2 ? 'bg-[#4656a2] text-white' : 'bg-slate-200 text-slate-500'
                }`}>
                  2
                </div>
                <span className={`text-xs font-bold ${step === 2 ? 'text-[#4656a2]' : 'text-slate-400'}`}>Quét mặt</span>
              </div>
              <div className="flex-grow h-[1px] bg-slate-200 mx-2"></div>
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step >= 3 ? 'bg-[#4656a2] text-white' : 'bg-slate-200 text-slate-500'
                }`}>
                  3
                </div>
                <span className={`text-xs font-bold ${step === 3 ? 'text-[#4656a2]' : 'text-slate-400'}`}>Mật khẩu</span>
              </div>
            </div>

            {/* Status Feedback */}
            {status && (
              <div className="mb-6 p-4 rounded-xl border border-blue-100 bg-blue-50/50 text-blue-800 text-xs font-semibold flex items-center gap-2.5">
                <LoadingIndicator size="sm" tone="blue" />
                <span>{status}</span>
              </div>
            )}

            {/* STEP 1: Nhập Username */}
            {step === 1 && (
              <form onSubmit={handleUsernameSubmit} className="space-y-6">
                <div>
                  <label className="block font-semibold text-xs text-[#454651] mb-1.5" htmlFor="username">
                    Tên đăng nhập hoặc Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#757682]">
                      <span className="material-symbols-outlined text-[20px]">person</span>
                    </div>
                    <input
                      className="w-full pl-10 pr-4 py-3 bg-[#faf8ff] border border-[#c6c5d3] focus:border-2 focus:border-[#4656a2] rounded-lg text-sm text-[#171b2b] outline-none transition-all placeholder:text-[#c6c5d3]"
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Nhập tên đăng nhập của bạn..."
                      required
                      type="text"
                      disabled={busy}
                    />
                  </div>
                </div>

                <div className="pt-2 flex flex-col gap-3">
                  <button
                    disabled={busy || !username.trim()}
                    className="w-full bg-[#4656a2] hover:bg-[#5f6fbd] text-white font-bold text-sm py-3.5 rounded-lg shadow-sm hover:shadow-[0px_4px_8px_rgba(70,86,162,0.2)] transition-all hover:-translate-y-[1px] flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    type="submit"
                  >
                    Tiếp tục quét khuôn mặt
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="w-full bg-white hover:bg-slate-50 text-slate-700 border border-[#c6c5d3] font-bold text-sm py-3 rounded-lg flex justify-center items-center gap-1.5 active:scale-95 transition-all"
                  >
                    Quay lại đăng nhập
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: Quét khuôn mặt sinh trắc học */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="bg-slate-50 rounded-2xl p-4 border border-[#e4e7fe]/60 min-h-[240px] flex items-center justify-center">
                  <div className="w-full max-w-sm animate-in fade-in duration-300">
                    <FaceCapture
                      onCapture={handleFaceCapture}
                      onError={(msg) => toast.error(msg)}
                      disabled={busy}
                      label="Xác thực khuôn mặt khôi phục mật khẩu"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={busy}
                  className="w-full bg-white hover:bg-slate-50 text-slate-700 border border-[#c6c5d3] font-bold text-sm py-3 rounded-lg flex justify-center items-center gap-1.5 active:scale-95 transition-all disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                  Quay lại
                </button>
              </div>
            )}

            {/* STEP 3: Đổi mật khẩu mới */}
            {step === 3 && (
              <form onSubmit={handlePasswordReset} className="space-y-5">
                <div>
                  <label className="block font-semibold text-xs text-[#454651] mb-1.5" htmlFor="new-password">
                    Mật khẩu mới
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#757682]">
                      <span className="material-symbols-outlined text-[20px]">lock</span>
                    </div>
                    <input
                      className="w-full pl-10 pr-10 py-3 bg-[#faf8ff] border border-[#c6c5d3] focus:border-2 focus:border-[#4656a2] rounded-lg text-sm text-[#171b2b] outline-none transition-all placeholder:text-[#c6c5d3]"
                      id="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Tối thiểu 8 ký tự..."
                      required
                      type={showNewPassword ? 'text' : 'password'}
                      disabled={busy}
                    />
                    <button
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#757682] hover:text-[#4656a2] transition-colors"
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {showNewPassword ? 'visibility' : 'visibility_off'}
                      </span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-xs text-[#454651] mb-1.5" htmlFor="confirm-password">
                    Xác nhận mật khẩu mới
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#757682]">
                      <span className="material-symbols-outlined text-[20px]">lock</span>
                    </div>
                    <input
                      className="w-full pl-10 pr-10 py-3 bg-[#faf8ff] border border-[#c6c5d3] focus:border-2 focus:border-[#4656a2] rounded-lg text-sm text-[#171b2b] outline-none transition-all placeholder:text-[#c6c5d3]"
                      id="confirm-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Nhập lại mật khẩu..."
                      required
                      type={showConfirmPassword ? 'text' : 'password'}
                      disabled={busy}
                    />
                    <button
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#757682] hover:text-[#4656a2] transition-colors"
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {showConfirmPassword ? 'visibility' : 'visibility_off'}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    disabled={busy || newPassword.length < 8 || newPassword !== confirmPassword}
                    className="w-full bg-[#4656a2] hover:bg-[#5f6fbd] text-white font-bold text-sm py-3.5 rounded-lg shadow-sm hover:shadow-[0px_4px_8px_rgba(70,86,162,0.2)] transition-all hover:-translate-y-[1px] flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    type="submit"
                  >
                    Cập nhật mật khẩu mới
                    <span className="material-symbols-outlined text-[18px]">verified</span>
                  </button>
                </div>
              </form>
            )}

          </div>
        </main>

        {/* Decorative background ambient blobs */}
        <div className="fixed top-[-10%] left-[-5%] w-[40vw] h-[40vw] rounded-full bg-[#cad2fe]/10 blur-[100px] pointer-events-none -z-10"></div>
        <div className="fixed bottom-[-10%] right-[-5%] w-[50vw] h-[50vw] rounded-full bg-[#dde1ff]/20 blur-[120px] pointer-events-none -z-10"></div>

        {/* Footer */}
        <footer className="w-full py-10 bg-[#ffffff] relative z-10 border-t border-[#dee1f8]/30">
          <div className="flex flex-col md:flex-row justify-between items-center px-10 max-w-[1280px] mx-auto gap-6 md:gap-0">
            <div className="flex flex-col items-center md:items-start gap-2">
              <span className="text-sm font-bold text-[#4656a2]">Định danh Y tế</span>
              <p className="text-xs font-semibold text-[#545d82] text-center md:text-left">
                © 2026 Hệ thống Định danh Y tế. Bảo lưu mọi quyền.
              </p>
            </div>
            <nav className="flex flex-wrap justify-center gap-6">
              <span className="text-xs font-semibold text-[#454651] hover:text-[#4656a2] hover:underline cursor-pointer transition-opacity duration-200">Chính sách bảo mật</span>
              <span className="text-xs font-semibold text-[#454651] hover:text-[#4656a2] hover:underline cursor-pointer transition-opacity duration-200">Điều khoản sử dụng</span>
              <span className="text-xs font-semibold text-[#454651] hover:text-[#4656a2] hover:underline cursor-pointer transition-opacity duration-200">Kiểm toán bảo mật</span>
              <span className="text-xs font-semibold text-[#454651] hover:text-[#4656a2] hover:underline cursor-pointer transition-opacity duration-200">Hỗ trợ</span>
            </nav>
          </div>
        </footer>
      </div>
    </div>
  );
}

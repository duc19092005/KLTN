import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../apis/authService';
import { useAuth } from '../../../providers/AuthProvider';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useToast } from '../../../providers/ToastProvider';
import { getDashboardRoute } from '../../../shared/constants/roleRoutes';

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { updateSession } = useAuth();

  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [busy, setBusy] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp.');
      return;
    }
    setBusy(true);
    try {
      const result = await authService.changePassword(form.currentPassword, form.newPassword);
      
      // Activation flow: backend sets the verified JWT as an HttpOnly cookie and returns
      // a step-up session in the body. Detect that flow via stepUpSession (access_token
      // is stripped server-side for safety). Persist the user state synchronously so
      // ProtectedRoute does not bounce us back here on the next render.
      if (result.data.stepUpSession?.session) {
        if (result.data.user) updateSession(result.data.user);
        window.dispatchEvent(new CustomEvent('hms-stepup-session', { detail: {
          session: result.data.stepUpSession.session,
          idleExpiresAt: result.data.stepUpSession.idleExpiresAt,
          absoluteExpiresAt: result.data.stepUpSession.absoluteExpiresAt,
        } }));
        toast.success('Đổi mật khẩu thành công! Chào mừng trở lại.');
        navigate(getDashboardRoute(result.data.user?.role || 'RECEPTIONIST'), { replace: true });
        return;
      }

      // Non-activation path (e.g. routine password rotation): just inform the user.
      // The existing session/token is unchanged, so we stay on the dashboard.
      toast.success('Đổi mật khẩu thành công.');
      navigate(getDashboardRoute(result.data.user?.role || 'RECEPTIONIST'), { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Không đổi được mật khẩu.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#faf8ff] text-[#171b2b] antialiased relative">
      {/* Local styles for Plus Jakarta Sans and ambient background overlay */}
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        
        .hms-login-portal {
          font-family: 'Plus Jakarta Sans', sans-serif;
          --primary-fixed: #dde1ff;
          --surface-container-lowest: #ffffff;
          --surface-bright: #faf8ff;
          --primary: #4656a2;
          --surface-container: #ebedff;
          --surface-container-high: #e4e7fe;
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

      <div className="hms-login-portal ambient-bg-login flex-grow flex flex-col justify-between min-h-screen">
        {/* Main Content Area: Centered Login Canvas */}
        <main className="flex-grow flex items-center justify-center px-6 py-12 relative z-10">
          <div className="bg-[#ffffff] shadow-[0px_20px_40px_rgba(99,115,193,0.08)] rounded-2xl w-full max-w-[480px] p-8 md:p-10 relative overflow-hidden backdrop-blur-sm border border-[#e4e7fe]/50">
            {/* Header */}
            <div className="text-center mb-8 flex flex-col items-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#dde1ff] text-[#4656a2] mb-4">
                <span className="material-symbols-outlined fill text-[28px]">lock_reset</span>
              </div>
              <h1 className="text-2xl font-bold text-[#4656a2] tracking-tight">Đổi mật khẩu bắt buộc</h1>
              <p className="text-sm font-semibold text-[#454651] mt-2">
                Đây là lần đăng nhập đầu tiên. Vui lòng đổi mật khẩu trước khi đăng ký/xác thực khuôn mặt.
              </p>
            </div>

            <form onSubmit={submit} className="space-y-5">
              {/* Current Password */}
              <Input
                id="current-password"
                label="Mật khẩu hiện tại"
                type={showCurrent ? 'text' : 'password'}
                value={form.currentPassword}
                onChange={(v) => setForm({ ...form, currentPassword: v })}
                showPassword={showCurrent}
                setShowPassword={setShowCurrent}
                busy={busy}
              />

              {/* New Password */}
              <Input
                id="new-password"
                label="Mật khẩu mới"
                type={showNew ? 'text' : 'password'}
                value={form.newPassword}
                onChange={(v) => setForm({ ...form, newPassword: v })}
                showPassword={showNew}
                setShowPassword={setShowNew}
                busy={busy}
              />

              {/* Confirm Password */}
              <Input
                id="confirm-password"
                label="Nhập lại mật khẩu mới"
                type={showConfirm ? 'text' : 'password'}
                value={form.confirmPassword}
                onChange={(v) => setForm({ ...form, confirmPassword: v })}
                showPassword={showConfirm}
                setShowPassword={setShowConfirm}
                busy={busy}
              />

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  disabled={busy || !form.currentPassword || !form.newPassword || !form.confirmPassword}
                  className="w-full bg-[#4656a2] hover:bg-[#5f6fbd] text-white font-bold text-sm py-3.5 rounded-lg shadow-sm hover:shadow-[0px_4px_8px_rgba(70,86,162,0.2)] transition-all hover:-translate-y-[1px] flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  type="submit"
                >
                  {busy ? (
                    <LoadingIndicator size="sm" tone="white" />
                  ) : (
                    <>
                      Đổi mật khẩu và tiếp tục
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </>
                  )}
                </button>
              </div>
            </form>
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

function Input({ id, label, type, value, onChange, showPassword, setShowPassword, busy }) {
  return (
    <div>
      <label className="block font-semibold text-xs text-[#454651] mb-1.5" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#757682]">
          <span className="material-symbols-outlined text-[20px]">lock</span>
        </div>
        <input
          className="w-full pl-10 pr-10 py-3 bg-[#faf8ff] border border-[#c6c5d3] focus:border-2 focus:border-[#4656a2] rounded-lg text-sm text-[#171b2b] outline-none transition-all placeholder:text-[#c6c5d3]"
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          required
          type={type}
          disabled={busy}
          minLength={6}
        />
        <button
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#757682] hover:text-[#4656a2] transition-colors"
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          disabled={busy}
        >
          <span className="material-symbols-outlined text-[20px]">
            {showPassword ? 'visibility' : 'visibility_off'}
          </span>
        </button>
      </div>
    </div>
  );
}

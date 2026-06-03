import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import { useAuth } from '../../../providers/AuthProvider';
import { authService } from '../apis/authService';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { getDashboardRoute } from '../../../shared/constants/roleRoutes';
import { useToast } from '../../../providers/ToastProvider';

export default function LoginPage({ isModal = false, onClose = null, initialMode = 'staff' }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { loginWithWallet, loginWithInvite, loginWithPassword, loading } = useAuth();
  const [mode, setMode] = useState(initialMode); // staff, wallet, invite
  const [inviteToken, setInviteToken] = useState('');
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const isFormDisabled = busy || loading;

  const handleWalletLogin = async () => {
    if (!window.ethereum) {
      toast.error('MetaMask is required for admin wallet login.');
      return;
    }
    try {
      setBusy(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const challenge = await authService.walletChallenge(address);
      const signature = await signer.signMessage(challenge.data.message);
      const result = await loginWithWallet(address, signature, challenge.data.message);
      if (!result.success) throw new Error(result.error);
      if (result.requirePasswordChange) return navigate('/change-password', { replace: true });
      if (result.requireVerification || result.requireFaceRegistration || result.requireFaceVerification) {
        return navigate('/authenticate', { replace: true });
      }
      navigate(getDashboardRoute(result.user?.role), { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Xác thực ví thất bại.');
    } finally {
      setBusy(false);
    }
  };

  const handleInviteLogin = async (event) => {
    event.preventDefault();
    try {
      setBusy(true);
      const result = await loginWithInvite(inviteToken.trim());
      if (!result.success) throw new Error(result.error);
      navigate('/authenticate', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Mã mời không hợp lệ hoặc đã hết hạn.');
    } finally {
      setBusy(false);
    }
  };

  const handleStaffLogin = async (event) => {
    event.preventDefault();
    try {
      setBusy(true);
      const result = await loginWithPassword(credentials.username.trim(), credentials.password);
      if (!result.success) throw new Error(result.error);
      if (result.requirePasswordChange) return navigate('/change-password', { replace: true });
      if (result.requireFaceRegistration || result.requireFaceVerification) {
        return navigate('/authenticate', { replace: true });
      }
      navigate(getDashboardRoute(result.user?.role), { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Tên đăng nhập hoặc mật khẩu không hợp lệ.');
    } finally {
      setBusy(false);
    }
  };

  const cardContent = (
    <div className="bg-[#ffffff] shadow-[0px_20px_40px_rgba(99,115,193,0.08)] rounded-2xl w-full max-w-[480px] p-8 md:p-10 relative overflow-hidden backdrop-blur-sm border border-[#e4e7fe]/50">
      {isModal && (
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-[#757682] hover:text-[#4656a2] transition-colors z-20 flex items-center justify-center p-1 rounded-full hover:bg-slate-100"
          aria-label="Close modal"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      )}
      
      {/* Brand Header */}
      <div className="text-center mb-8 flex flex-col items-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#dde1ff] text-[#4656a2] mb-4">
          <span className="material-symbols-outlined fill text-[28px]">medical_services</span>
        </div>
        <h1 className="text-2xl font-bold text-[#4656a2] tracking-tight">Medicare Identity</h1>
        <p className="text-sm font-semibold text-[#454651] mt-2">Cổng truy cập bảo mật y tế</p>
      </div>

      {/* Contextual Tabs / Segmented Control */}
      <div className="flex bg-[#f3f2ff] p-1 rounded-lg mb-8 shadow-inner border border-[#ebedff]">
        <button
          type="button"
          onClick={() => setMode('staff')}
          className={`flex-1 py-2.5 px-4 text-center rounded-md font-semibold text-xs transition-all flex items-center justify-center gap-1.5 ${
            mode === 'staff'
              ? 'bg-[#ffffff] shadow-sm text-[#4656a2]'
              : 'text-[#454651] hover:text-[#4656a2]'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">medical_services</span>
          <span>Nhân sự</span>
        </button>
        <button
          type="button"
          onClick={() => setMode('wallet')}
          className={`flex-1 py-2.5 px-4 text-center rounded-md font-semibold text-xs transition-all flex items-center justify-center gap-1.5 ${
            mode === 'wallet'
              ? 'bg-[#ffffff] shadow-sm text-[#4656a2]'
              : 'text-[#454651] hover:text-[#4656a2]'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
          <span>Ví Admin</span>
        </button>
        <button
          type="button"
          onClick={() => setMode('invite')}
          className={`flex-1 py-2.5 px-4 text-center rounded-md font-semibold text-xs transition-all flex items-center justify-center gap-1.5 ${
            mode === 'invite'
              ? 'bg-[#ffffff] shadow-sm text-[#4656a2]'
              : 'text-[#454651] hover:text-[#4656a2]'
          }`}
        >
          <span className="material-symbols-outlined fill text-[18px]">group_add</span>
          <span>Mã mời</span>
        </button>
      </div>

      {/* TAB CONTENT: Staff Login */}
      {mode === 'staff' && (
        <form onSubmit={handleStaffLogin} className="space-y-5">
          {/* Email/Username Field */}
          <div>
            <label className="block font-semibold text-xs text-[#454651] mb-1.5" htmlFor="username">
              Email or Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#757682]">
                <span className="material-symbols-outlined text-[20px]">person</span>
              </div>
              <input
                className="w-full pl-10 pr-4 py-3 bg-[#faf8ff] border border-[#c6c5d3] focus:border-2 focus:border-[#4656a2] rounded-lg text-sm text-[#171b2b] outline-none transition-all placeholder:text-[#c6c5d3]"
                id="username"
                name="username"
                value={credentials.username}
                onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                placeholder="Enter your credential"
                required
                type="text"
                disabled={isFormDisabled}
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label className="block font-semibold text-xs text-[#454651] mb-1.5" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#757682]">
                <span className="material-symbols-outlined text-[20px]">lock</span>
              </div>
              <input
                className="w-full pl-10 pr-10 py-3 bg-[#faf8ff] border border-[#c6c5d3] focus:border-2 focus:border-[#4656a2] rounded-lg text-sm text-[#171b2b] outline-none transition-all placeholder:text-[#c6c5d3]"
                id="password"
                name="password"
                value={credentials.password}
                onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                placeholder="••••••••"
                required
                type={showPassword ? 'text' : 'password'}
                disabled={isFormDisabled}
              />
              <button
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#757682] hover:text-[#4656a2] transition-colors"
                type="button"
                onClick={() => setShowPassword(!showPassword)}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {showPassword ? 'visibility' : 'visibility_off'}
                </span>
              </button>
            </div>
          </div>

          {/* Utilities Row */}
          <div className="flex items-center justify-between mt-2 text-xs">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                className="w-4 h-4 rounded border-[#c6c5d3] text-[#4656a2] focus:ring-[#4656a2] focus:ring-offset-[#ffffff] bg-[#faf8ff] transition-all"
                type="checkbox"
              />
              <span className="font-medium text-[#454651] group-hover:text-[#171b2b] transition-colors">
                Remember me
              </span>
            </label>
            <button
              type="button"
              onClick={() => {
                if (isModal && onClose) onClose();
                navigate('/forgot-password');
              }}
              className="font-semibold text-[#4656a2] hover:text-[#5f6fbd] transition-colors"
            >
              Forgot password?
            </button>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              disabled={isFormDisabled || !credentials.username.trim() || !credentials.password}
              className="w-full bg-[#4656a2] hover:bg-[#5f6fbd] text-white font-bold text-sm py-3.5 rounded-lg shadow-sm hover:shadow-[0px_4px_8px_rgba(70,86,162,0.2)] transition-all hover:-translate-y-[1px] flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              type="submit"
            >
              {busy ? (
                <LoadingIndicator size="sm" tone="white" />
              ) : (
                <>
                  Sign In to Workspace
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </>
              )}
            </button>
          </div>

          {/* Paraclinical Account Switcher Link */}
          <div className="text-center pt-4 border-t border-[#ebedff] mt-4">
            <button
              type="button"
              onClick={() => {
                if (isModal && onClose) onClose();
                navigate('/paraclinical-login');
              }}
              className="text-xs font-bold text-[#006b5b] hover:text-[#004a99] hover:underline transition-colors flex items-center justify-center gap-1.5 mx-auto"
            >
              <span className="material-symbols-outlined text-[16px]">desktop_windows</span>
              Đăng nhập tài khoản CLS (Phòng máy)
            </button>
          </div>
        </form>
      )}

      {/* TAB CONTENT: Wallet Login */}
      {mode === 'wallet' && (
        <div className="text-center flex flex-col items-center py-4">
          {/* Hero Icon */}
          <div className="relative w-24 h-24 mb-6 flex items-center justify-center">
            <div className="absolute inset-0 bg-[#dde1ff] rounded-full opacity-50 blur-xl"></div>
            <div className="relative z-10 w-16 h-16 bg-[#dee1f8] rounded-full flex items-center justify-center border-4 border-[#ffffff] shadow-sm">
              <span className="material-symbols-outlined text-[#4656a2] text-3xl">account_balance_wallet</span>
            </div>
          </div>

          {/* Instructions */}
          <h2 className="text-lg font-bold text-[#171b2b] mb-3">Authentication Required</h2>
          <p className="text-xs font-semibold text-[#454651] mb-8 max-w-[280px] mx-auto leading-relaxed">
            Please connect your MetaMask or compatible Web3 wallet to access the administrative dashboard securely.
          </p>

          {/* Status Chip / Notice */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#f3f2ff] text-[#454651] font-semibold text-xs mb-8 border border-[#dee1f8]">
            <span className="w-2 h-2 rounded-full bg-[#545d82]"></span>
            Network: Hardhat Local / Mainnet
          </div>

          {/* Primary Action Button */}
          <button
            onClick={handleWalletLogin}
            disabled={isFormDisabled}
            className="w-full bg-[#4656a2] hover:bg-[#4959a5] text-white font-bold text-sm py-4 px-6 rounded-xl shadow-md hover:shadow-lg hover:-translate-y-[1px] transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? (
              <LoadingIndicator size="sm" tone="white" />
            ) : (
              <>
                <span className="material-symbols-outlined text-[20px]">vpn_key</span>
                Kết nối ví &amp; Ký xác thực
              </>
            )}
          </button>

          {/* Help Link */}
          <a className="mt-6 text-xs text-[#757682] hover:text-[#4656a2] transition-colors hover:underline" href="#">
            Need help connecting a wallet?
          </a>
        </div>
      )}

      {/* TAB CONTENT: Invite Code Login */}
      {mode === 'invite' && (
        <form onSubmit={handleInviteLogin} className="flex flex-col gap-6 py-2">
          <div className="flex flex-col gap-2 relative">
            <label className="font-semibold text-xs text-[#171b2b]" htmlFor="invite-code">
              Mã xác thực
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#c6c5d3]">
                vpn_key
              </span>
              <input
                autocomplete="off"
                className="w-full pl-12 pr-4 py-3 bg-[#faf8ff] border border-[#c6c5d3] rounded-lg text-sm text-[#171b2b] focus:outline-none focus:border-[#4656a2] focus:ring-1 focus:ring-[#4656a2] transition-all placeholder:text-[#757682]/70 shadow-sm"
                id="invite-code"
                value={inviteToken}
                onChange={(e) => setInviteToken(e.target.value)}
                placeholder="Nhập mã mời của bạn..."
                type="text"
                disabled={isFormDisabled}
                required
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              disabled={isFormDisabled || !inviteToken.trim()}
              className="w-full py-3.5 bg-[#4656a2] text-white font-bold text-sm rounded-lg shadow-sm hover:translate-y-[-1px] hover:shadow-[0px_8px_16px_rgba(70,86,162,0.15)] transition-all active:translate-y-[1px] active:shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              type="submit"
            >
              {busy ? (
                <LoadingIndicator size="sm" tone="white" />
              ) : (
                <>
                  Xác thực mã mời
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </>
              )}
            </button>
          </div>

          <div className="text-center mt-2">
            <p className="text-xs text-[#454651] font-semibold leading-relaxed">
              Mã mời được cấp phát nội bộ. Vui lòng liên hệ quản trị viên nếu bạn chưa có mã.
            </p>
          </div>
        </form>
      )}
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <style dangerouslySetInnerHTML={{__html: `
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
          .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          }
          .material-symbols-outlined.fill {
            font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          }
          @keyframes scaleUp {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
          }
          .animate-scale-up {
            animation: scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        `}} />
        <div 
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300"
        />
        <div className="hms-login-portal relative z-10 w-full max-w-[480px] animate-scale-up">
          {cardContent}
        </div>
      </div>
    );
  }

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
          {cardContent}
        </main>

        {/* Decorative background ambient blobs */}
        <div className="fixed top-[-10%] left-[-5%] w-[40vw] h-[40vw] rounded-full bg-[#cad2fe]/10 blur-[100px] pointer-events-none -z-10"></div>
        <div className="fixed bottom-[-10%] right-[-5%] w-[50vw] h-[50vw] rounded-full bg-[#dde1ff]/20 blur-[120px] pointer-events-none -z-10"></div>

        {/* Footer */}
        <footer className="w-full py-10 bg-[#ffffff] relative z-10 border-t border-[#dee1f8]/30">
          <div className="flex flex-col md:flex-row justify-between items-center px-10 max-w-[1280px] mx-auto gap-6 md:gap-0">
            <div className="flex flex-col items-center md:items-start gap-2">
              <span className="text-sm font-bold text-[#4656a2]">Medicare Identity</span>
              <p className="text-xs font-semibold text-[#545d82] text-center md:text-left">
                © 2026 Medicare Identity Blockchain Systems. All rights reserved.
              </p>
            </div>
            <nav className="flex flex-wrap justify-center gap-6">
              <span className="text-xs font-semibold text-[#454651] hover:text-[#4656a2] hover:underline cursor-pointer transition-opacity duration-200">Privacy Policy</span>
              <span className="text-xs font-semibold text-[#454651] hover:text-[#4656a2] hover:underline cursor-pointer transition-opacity duration-200">Terms of Service</span>
              <span className="text-xs font-semibold text-[#454651] hover:text-[#4656a2] hover:underline cursor-pointer transition-opacity duration-200">Security Audit</span>
              <span className="text-xs font-semibold text-[#454651] hover:text-[#4656a2] hover:underline cursor-pointer transition-opacity duration-200">Support</span>
            </nav>
          </div>
        </footer>
      </div>
    </div>
  );
}
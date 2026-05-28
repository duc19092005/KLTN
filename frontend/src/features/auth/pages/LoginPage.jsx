import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import { useAuth } from '../../../providers/AuthProvider';
import { authService } from '../apis/authService';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';

export default function LoginPage() {
  const navigate = useNavigate();
  const { loginWithWallet, loginWithInvite, loading } = useAuth();

  const [mode, setMode] = useState('wallet');
  const [inviteToken, setInviteToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleWalletLogin = async () => {
    setError('');
    if (!window.ethereum) {
      setError('MetaMask is required for admin wallet login.');
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
      navigate('/authenticate');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Xác thực ví thất bại.');
    } finally {
      setBusy(false);
    }
  };

  const handleInviteLogin = async (event) => {
    event.preventDefault();
    setError('');

    try {
      setBusy(true);
      const result = await loginWithInvite(inviteToken.trim());
      if (!result.success) throw new Error(result.error);
      navigate('/authenticate');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Mã mời không hợp lệ hoặc đã hết hạn.');
    } finally {
      setBusy(false);
    }
  };

  const isFormDisabled = busy || loading;

  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-[#F4F7FA] font-sans antialiased p-4 selection:bg-blue-100 selection:text-blue-700">
      <section className="w-full max-w-[420px] bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-8">

        {/* Header & Logo */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-12 h-12 bg-blue-600 text-white font-bold rounded-xl flex items-center justify-center shadow-sm shadow-blue-200 mb-4">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1.5">
            Med Identity OS
          </p>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">
            Xác thực Quản trị
          </h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            Đăng nhập bằng ví y tế hoặc sử dụng mã mời bảo mật được cấp từ hệ thống backend.
          </p>
        </div>

        {/* Tab Switcher (Segmented Control) */}
        <div className="flex p-1 bg-slate-50 rounded-xl mb-6 border border-slate-100" role="tablist">
          <button
            id="wallet-mode-button"
            type="button"
            role="tab"
            aria-selected={mode === 'wallet'}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[14px] font-semibold rounded-lg transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-blue-400
              ${mode === 'wallet'
                ? 'bg-white text-blue-700 shadow-sm border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            onClick={() => { setMode('wallet'); setError(''); }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            Ví Crypto
          </button>
          <button
            id="invite-mode-button"
            type="button"
            role="tab"
            aria-selected={mode === 'invite'}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[14px] font-semibold rounded-lg transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-blue-400
              ${mode === 'invite'
                ? 'bg-white text-blue-700 shadow-sm border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            onClick={() => { setMode('invite'); setError(''); }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            Mã mời
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-3.5 bg-red-50/80 border border-red-100 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-1">
            <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium text-red-700 leading-snug">{error}</p>
          </div>
        )}

        {/* Form Area */}
        {mode === 'wallet' ? (
          <div className="flex flex-col gap-4">
            <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-[13px] text-blue-800 font-medium">Yêu cầu tiện ích MetaMask hoặc ví tương thích Web3 được cài đặt trên trình duyệt của bạn.</p>
            </div>
            <button
              id="wallet-login-button"
              type="button"
              onClick={handleWalletLogin}
              disabled={isFormDisabled}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white py-3 px-4 rounded-xl font-semibold transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
            >
              {busy ? (
                <LoadingIndicator size="sm" tone="white" />
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              )}
              {busy ? 'Đang kết nối ví...' : 'Kết nối ví & Ký xác thực'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleInviteLogin} className="flex flex-col gap-5">
            <div className="space-y-1.5">
              <label htmlFor="invite-token-input" className="block text-[13px] font-semibold text-slate-700">
                Mã thông báo (Invite Token)
              </label>
              <input
                id="invite-token-input"
                value={inviteToken}
                onChange={(event) => setInviteToken(event.target.value)}
                placeholder="Dán mã Bootstrap Token tại đây..."
                autoComplete="one-time-code"
                required
                disabled={isFormDisabled}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all duration-200 placeholder-slate-400 text-slate-800 disabled:opacity-60"
              />
            </div>
            <button
              id="invite-login-button"
              type="submit"
              disabled={isFormDisabled || !inviteToken.trim()}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white py-3 px-4 rounded-xl font-semibold transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
            >
              {busy ? <LoadingIndicator size="sm" tone="white" /> : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {busy ? 'Đang xác thực...' : 'Xác thực Mã mời'}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
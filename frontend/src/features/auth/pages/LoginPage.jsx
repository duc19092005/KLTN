import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import { useAuth } from '../../../providers/AuthProvider';
import { authService } from '../apis/authService';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { getDashboardRoute } from '../../../shared/constants/roleRoutes';
import { useToast } from '../../../providers/ToastProvider';

export default function LoginPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { loginWithWallet, loginWithInvite, loginWithPassword, loading } = useAuth();
  const [mode, setMode] = useState('staff');
  const [inviteToken, setInviteToken] = useState('');
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [busy, setBusy] = useState(false);

  const isFormDisabled = busy || loading;
  const switchMode = (nextMode) => { setMode(nextMode); };

  const handleWalletLogin = async () => {
    if (!window.ethereum) { toast.error('MetaMask is required for admin wallet login.'); return; }
    try {
      setBusy(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const challenge = await authService.walletChallenge(address);
      const signature = await signer.signMessage(challenge.data.message);
      const result = await loginWithWallet(address, signature, challenge.data.message);
      if (!result.success) throw new Error(result.error);
      navigate('/authenticate', { replace: true });
    } catch (err) { toast.error(err.response?.data?.message || err.message || 'Xác thực ví thất bại.'); }
    finally { setBusy(false); }
  };

  const handleInviteLogin = async (event) => {
    event.preventDefault();
    try {
      setBusy(true);
      const result = await loginWithInvite(inviteToken.trim());
      if (!result.success) throw new Error(result.error);
      navigate('/authenticate', { replace: true });
    } catch (err) { toast.error(err.response?.data?.message || err.message || 'Mã mời không hợp lệ hoặc đã hết hạn.'); }
    finally { setBusy(false); }
  };

  const handleStaffLogin = async (event) => {
    event.preventDefault();
    try {
      setBusy(true);
      const result = await loginWithPassword(credentials.username.trim(), credentials.password);
      if (!result.success) throw new Error(result.error);
      if (result.requirePasswordChange) return navigate('/change-password', { replace: true });
      if (result.requireFaceRegistration || result.requireFaceVerification) return navigate('/authenticate', { replace: true });
      navigate(getDashboardRoute(result.user?.role), { replace: true });
    } catch (err) { toast.error(err.response?.data?.message || err.message || 'Tên đăng nhập hoặc mật khẩu không hợp lệ.'); }
    finally { setBusy(false); }
  };

  return <main className="min-h-screen w-full flex items-center justify-center bg-[#F4F7FA] font-sans antialiased p-4 selection:bg-blue-100 selection:text-blue-700"><section className="w-full max-w-[460px] bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-8"><div className="flex flex-col items-center mb-8 text-center"><div className="w-12 h-12 bg-blue-600 text-white font-bold rounded-xl flex items-center justify-center shadow-sm shadow-blue-200 mb-4">✚</div><p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1.5">Med Identity OS</p><h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">Đăng nhập hệ thống</h1><p className="text-sm text-slate-500 leading-relaxed">Nhân sự đăng nhập bằng tài khoản được cấp. Admin sử dụng ví hoặc mã mời bảo mật.</p></div><div className="grid grid-cols-3 p-1 bg-slate-50 rounded-xl mb-6 border border-slate-100" role="tablist"><Tab id="staff-mode-button" active={mode === 'staff'} onClick={() => switchMode('staff')}>Nhân sự</Tab><Tab id="wallet-mode-button" active={mode === 'wallet'} onClick={() => switchMode('wallet')}>Ví Admin</Tab><Tab id="invite-mode-button" active={mode === 'invite'} onClick={() => switchMode('invite')}>Mã mời</Tab></div>{mode === 'staff' && <form onSubmit={handleStaffLogin} className="flex flex-col gap-4"><Field id="staff-username-input" label="Tên đăng nhập hoặc email" value={credentials.username} onChange={(v) => setCredentials({ ...credentials, username: v })} autoComplete="username" /><Field id="staff-password-input" label="Mật khẩu" type="password" value={credentials.password} onChange={(v) => setCredentials({ ...credentials, password: v })} autoComplete="current-password" /><SubmitButton id="staff-login-button" busy={busy} disabled={isFormDisabled || !credentials.username.trim() || !credentials.password}>Đăng nhập nhân sự</SubmitButton><p className="text-xs text-slate-400 text-center">Lễ tân, bác sĩ và quản lý xét nghiệm sẽ được chuyển về dashboard riêng sau xác thực khuôn mặt.</p></form>}{mode === 'wallet' && <div className="flex flex-col gap-4"><div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl text-[13px] text-blue-800 font-medium">Yêu cầu MetaMask hoặc ví Web3 tương thích để đăng nhập Admin.</div><SubmitButton id="wallet-login-button" busy={busy} disabled={isFormDisabled} onClick={handleWalletLogin}>Kết nối ví & Ký xác thực</SubmitButton></div>}{mode === 'invite' && <form onSubmit={handleInviteLogin} className="flex flex-col gap-5"><Field id="invite-token-input" label="Mã thông báo Admin" value={inviteToken} onChange={setInviteToken} autoComplete="one-time-code" /><SubmitButton id="invite-login-button" busy={busy} disabled={isFormDisabled || !inviteToken.trim()}>Xác thực mã mời</SubmitButton></form>}</section></main>;
}
function Tab({ id, active, onClick, children }) { return <button id={id} type="button" role="tab" aria-selected={active} className={`py-2.5 text-[13px] font-semibold rounded-lg transition-all outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${active ? 'bg-white text-blue-700 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`} onClick={onClick}>{children}</button>; }
function Field({ id, label, value, onChange, type = 'text', autoComplete }) { return <label htmlFor={id} className="space-y-1.5"><span className="block text-[13px] font-semibold text-slate-700">{label}</span><input id={id} value={value} type={type} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all placeholder-slate-400 text-slate-800 disabled:opacity-60" /></label>; }
function SubmitButton({ id, busy, disabled, onClick, children }) { return <button id={id} type={onClick ? 'button' : 'submit'} onClick={onClick} disabled={disabled} className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white py-3 px-4 rounded-xl font-semibold transition-all outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 disabled:opacity-70 disabled:cursor-not-allowed shadow-sm">{busy ? <LoadingIndicator size="sm" tone="white" /> : children}</button>; }
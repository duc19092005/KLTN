import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  Stethoscope,
  User,
  UserPlus,
  Wallet,
  X,
} from 'lucide-react';
import { useAuth } from '../../../providers/AuthProvider';
import { authService } from '../apis/authService';
import { getDashboardRoute } from '../../../shared/constants/roleRoutes';
import { useToast } from '../../../providers/ToastProvider';
import { Button, FormField, Input } from '../../../shared/components/ui';

const MODES = [
  { id: 'staff', label: 'Nhân sự', Icon: Stethoscope },
  { id: 'wallet', label: 'Ví Admin', Icon: Wallet },
  { id: 'invite', label: 'Mã mời', Icon: UserPlus },
];

export default function LoginPage({ isModal = false, onClose = null, initialMode = 'staff' }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { loginWithWallet, loginWithInvite, loginWithPassword, loading } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [inviteToken, setInviteToken] = useState('');
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const isFormDisabled = busy || loading;

  const routeAfterLogin = (result) => {
    if (!result.user?.hasFace) return navigate('/authenticate', { replace: true });
    if (result.requirePasswordChange) return navigate('/change-password', { replace: true });
    if (result.requireVerification || result.requireFaceRegistration || result.requireFaceVerification) {
      return navigate('/authenticate', { replace: true });
    }
    return navigate(getDashboardRoute(result.user?.role), { replace: true });
  };

  const handleWalletLogin = async () => {
    if (!window.ethereum) {
      toast.error('Vui lòng cài đặt MetaMask để đăng nhập quản trị bằng ví.');
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
      routeAfterLogin(result);
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
      routeAfterLogin(result);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Tên đăng nhập hoặc mật khẩu không hợp lệ.');
    } finally {
      setBusy(false);
    }
  };

  const card = (
    <section className="relative w-full max-w-[480px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
      {isModal && (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
          aria-label="Đóng hộp thoại"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      <div className="mb-7 text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100">
          <ShieldCheck className="h-6 w-6" strokeWidth={2.25} />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-slate-950">Hospital OS</h1>
        <p className="mt-2 text-sm font-semibold text-slate-500">Cổng truy cập bảo mật y tế</p>
      </div>

      <div className="mb-7 grid grid-cols-3 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
        {MODES.map(({ id, label, Icon }) => {
          const active = mode === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-xs font-black transition-colors ${
                active ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={2.25} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {mode === 'staff' && (
        <form onSubmit={handleStaffLogin} className="space-y-4">
          <FormField label="Email hoặc tên đăng nhập" htmlFor="username">
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="username"
                name="username"
                value={credentials.username}
                onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                placeholder="Nhập email hoặc tên đăng nhập"
                required
                type="text"
                disabled={isFormDisabled}
                className="pl-10"
              />
            </div>
          </FormField>

          <FormField label="Mật khẩu" htmlFor="password">
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="password"
                name="password"
                value={credentials.password}
                onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                placeholder="Nhập mật khẩu"
                required
                type={showPassword ? 'text' : 'password'}
                disabled={isFormDisabled}
                className="pl-10 pr-10"
              />
              <button
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 transition-colors hover:text-cyan-700"
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </FormField>

          <div className="flex items-center justify-between gap-3 text-xs">
            <label className="flex items-center gap-2 font-semibold text-slate-500">
              <input className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500" type="checkbox" />
              Ghi nhớ đăng nhập
            </label>
            <button
              type="button"
              onClick={() => {
                if (isModal && onClose) onClose();
                navigate('/forgot-password');
              }}
              className="font-black text-cyan-700 hover:text-cyan-800"
            >
              Quên mật khẩu?
            </button>
          </div>

          <Button
            type="submit"
            className="w-full"
            size="lg"
            loading={busy}
            disabled={isFormDisabled || !credentials.username.trim() || !credentials.password}
          >
            Đăng nhập hệ thống
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      )}

      {mode === 'wallet' && (
        <div className="text-center">
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl border border-cyan-100 bg-cyan-50 text-cyan-700">
            <Wallet className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-black text-slate-950">Xác thực quản trị</h2>
          <p className="mx-auto mt-2 max-w-xs text-sm font-semibold leading-relaxed text-slate-500">
            Kết nối MetaMask hoặc ví Web3 tương thích để truy cập khu vực quản trị.
          </p>
          <div className="my-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-600">
            <span className="h-2 w-2 rounded-full bg-cyan-600" />
            Mạng blockchain audit
          </div>
          <Button onClick={handleWalletLogin} disabled={isFormDisabled} loading={busy} size="lg" className="w-full">
            <KeyRound className="h-4 w-4" />
            Kết nối ví và ký xác thực
          </Button>
        </div>
      )}

      {mode === 'invite' && (
        <form onSubmit={handleInviteLogin} className="space-y-5">
          <FormField label="Mã xác thực" htmlFor="invite-code" hint="Mã mời được cấp phát nội bộ bởi quản trị viên.">
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="invite-code"
                autoComplete="off"
                value={inviteToken}
                onChange={(e) => setInviteToken(e.target.value)}
                placeholder="Nhập mã mời của bạn"
                type="text"
                disabled={isFormDisabled}
                required
                className="pl-10"
              />
            </div>
          </FormField>
          <Button
            type="submit"
            className="w-full"
            size="lg"
            loading={busy}
            disabled={isFormDisabled || !inviteToken.trim()}
          >
            Xác thực mã mời
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      )}
    </section>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div onClick={onClose} className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" />
        <div className="relative z-10 w-full max-w-[480px] animate-fadeIn">{card}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <main className="flex min-h-screen items-center justify-center px-4 py-10">
        {card}
      </main>
      <footer className="border-t border-slate-200 bg-white px-6 py-6 text-center text-xs font-semibold text-slate-500">
        © 2026 KLTN Hospital OS. Bảo mật sinh trắc học và toàn vẹn blockchain.
      </footer>
    </div>
  );
}

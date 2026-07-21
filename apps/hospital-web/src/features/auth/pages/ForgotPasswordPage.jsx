import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ethers } from 'ethers';
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, ScanFace, User, Wallet } from 'lucide-react';
import { authService } from '../apis/authService';
import FaceCapture from '../components/FaceCapture';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useToast } from '../../../providers/ToastProvider';
import { Button, FormField, Input } from '../../../shared/components/ui';

const STEPS = [
  { id: 1, label: 'Tài khoản' },
  { id: 2, label: 'Quét mặt' },
  { id: 3, label: 'Mật khẩu' },
];

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [accountType, setAccountType] = useState(searchParams.get('account') === 'admin' ? 'admin' : 'staff');

  const [step, setStep] = useState(1);
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

  const handleUsernameSubmit = async (event) => {
    event.preventDefault();
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
      setStatus('');
      toast.error(err.response?.data?.message || 'Không thể xác thực tài khoản này.');
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
      setStatus('');
      toast.error(err.response?.data?.message || 'Xác thực khuôn mặt thất bại.');
      setStep(1);
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordReset = async (event) => {
    event.preventDefault();
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
      setStatus('');
      toast.error(err.response?.data?.message || 'Không thể đặt lại mật khẩu.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10 text-slate-950">
      <section className="w-full max-w-[520px] rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100">
            <ScanFace className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950">
            {accountType === 'admin' ? 'Khôi phục ví Admin' : 'Khôi phục mật khẩu'}
          </h1>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            {accountType === 'admin'
              ? 'Xác thực khuôn mặt của Admin duy nhất trước khi liên kết ví mới.'
              : 'Xác thực sinh trắc học trước khi đặt mật khẩu mới.'}
          </p>
        </div>

        <div className="mb-7 grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setAccountType('staff')}
            className={`rounded-lg px-3 py-2.5 text-xs font-black ${accountType === 'staff' ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-500'}`}
          >
            Nhân sự
          </button>
          <button
            type="button"
            onClick={() => setAccountType('admin')}
            className={`rounded-lg px-3 py-2.5 text-xs font-black ${accountType === 'admin' ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-500'}`}
          >
            Admin
          </button>
        </div>

        {accountType === 'admin' ? (
          <AdminWalletRecoveryPanel onBack={() => navigate('/login')} />
        ) : (
          <>

        <div className="mb-7 grid grid-cols-3 gap-2">
          {STEPS.map((item) => {
            const active = step === item.id;
            const done = step > item.id;
            return (
              <div key={item.id} className={`rounded-xl border px-3 py-2 text-center text-xs font-black ${active || done ? 'border-cyan-200 bg-cyan-50 text-cyan-700' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                {done ? <CheckCircle2 className="mx-auto mb-1 h-4 w-4" /> : <span className="mb-1 block">{item.id}</span>}
                {item.label}
              </div>
            );
          })}
        </div>

        {status && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-xs font-bold text-cyan-800">
            <LoadingIndicator size="sm" tone="cyan" />
            {status}
          </div>
        )}

        {step === 1 && (
          <form onSubmit={handleUsernameSubmit} className="space-y-5">
            <FormField label="Tên đăng nhập hoặc email" htmlFor="username">
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Nhập tài khoản của bạn"
                  required
                  type="text"
                  disabled={busy}
                  className="pl-10"
                />
              </div>
            </FormField>
            <Button type="submit" size="lg" className="w-full" loading={busy} disabled={busy || !username.trim()}>
              Tiếp tục quét khuôn mặt
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button type="button" variant="secondary" size="lg" className="w-full" onClick={() => navigate('/login')} disabled={busy}>
              <ArrowLeft className="h-4 w-4" />
              Quay lại đăng nhập
            </Button>
          </form>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <FaceCapture
                onCapture={handleFaceCapture}
                onError={(message) => toast.error(message)}
                disabled={busy}
                label="Xác thực khuôn mặt khôi phục mật khẩu"
              />
            </div>
            <Button type="button" variant="secondary" size="lg" className="w-full" onClick={() => setStep(1)} disabled={busy}>
              <ArrowLeft className="h-4 w-4" />
              Quay lại
            </Button>
          </div>
        )}

        {step === 3 && (
          <form onSubmit={handlePasswordReset} className="space-y-5">
            <PasswordInput
              id="new-password"
              label="Mật khẩu mới"
              value={newPassword}
              onChange={setNewPassword}
              visible={showNewPassword}
              onToggle={() => setShowNewPassword((value) => !value)}
              disabled={busy}
            />
            <PasswordInput
              id="confirm-password"
              label="Xác nhận mật khẩu mới"
              value={confirmPassword}
              onChange={setConfirmPassword}
              visible={showConfirmPassword}
              onToggle={() => setShowConfirmPassword((value) => !value)}
              disabled={busy}
            />
            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={busy}
              disabled={busy || newPassword.length < 8 || newPassword !== confirmPassword}
            >
              Cập nhật mật khẩu mới
              <CheckCircle2 className="h-4 w-4" />
            </Button>
          </form>
        )}
          </>
        )}
      </section>
    </main>
  );
}

function AdminWalletRecoveryPanel({ onBack }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [challenge, setChallenge] = useState('');
  const [recoveryToken, setRecoveryToken] = useState('');
  const [busy, setBusy] = useState(true);
  const [status, setStatus] = useState('Đang tạo yêu cầu xác thực khuôn mặt...');
  const [challengeError, setChallengeError] = useState('');

  const requestChallenge = async () => {
    setBusy(true);
    setChallenge('');
    setChallengeError('');
    setStatus('Đang tạo yêu cầu xác thực khuôn mặt...');
    try {
      const response = await authService.adminWalletRecoveryChallenge();
      setChallenge(response.data.challenge);
      setStatus('');
    } catch (error) {
      const message = error.response?.data?.message || 'Không thể bắt đầu khôi phục ví Admin.';
      setStatus('');
      setChallengeError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    let active = true;

    const createChallenge = async () => {
      try {
        const response = await authService.adminWalletRecoveryChallenge();
        if (!active) return;
        setChallenge(response.data.challenge);
        setStatus('');
      } catch (error) {
        if (!active) return;
        const message = error.response?.data?.message || 'Không thể bắt đầu khôi phục ví Admin.';
        setStatus('');
        setChallengeError(message);
        toast.error(message);
      } finally {
        if (active) setBusy(false);
      }
    };

    createChallenge();
    return () => {
      active = false;
    };
  }, []);

  const handleFaceCapture = async (embedding) => {
    if (!challenge) return;
    setBusy(true);
    setStatus('Đang xác thực khuôn mặt Admin...');
    try {
      const response = await authService.adminWalletRecoveryVerifyFace(embedding, challenge);
      setRecoveryToken(response.data.recoveryToken);
      setStatus('');
      toast.success('Khuôn mặt hợp lệ. Hãy kết nối ví mới.');
    } catch (error) {
      setStatus('');
      toast.error(error.response?.data?.message || 'Xác thực khuôn mặt Admin thất bại.');
      await requestChallenge();
    } finally {
      setBusy(false);
    }
  };

  const handleNewWallet = async () => {
    if (!window.ethereum) {
      toast.error('Vui lòng cài đặt MetaMask hoặc ví Web3 tương thích.');
      return;
    }

    setBusy(true);
    setStatus('Đang xác minh quyền sở hữu ví mới...');
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const challengeResponse = await authService.adminWalletRecoveryWalletChallenge(recoveryToken, address);
      const signature = await signer.signMessage(challengeResponse.data.message);
      await authService.adminWalletRecoveryConfirm(
        recoveryToken,
        address,
        signature,
        challengeResponse.data.message,
      );
      setStatus('');
      toast.success('Đã thay đổi ví Admin. Vui lòng đăng nhập lại bằng ví mới.');
      navigate('/login', { replace: true });
    } catch (error) {
      setStatus('');
      toast.error(error.response?.data?.message || error.message || 'Không thể thay đổi ví Admin.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {status && (
        <div className="flex items-center gap-2 rounded-xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-xs font-bold text-cyan-800">
          <LoadingIndicator size="sm" tone="cyan" />
          {status}
        </div>
      )}

      {!recoveryToken ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          {challenge && (
            <FaceCapture
              onCapture={handleFaceCapture}
              onError={(message) => toast.error(message)}
              disabled={busy}
              label="Xác thực khuôn mặt Admin"
            />
          )}
          {!challenge && !busy && challengeError && (
            <div className="text-center">
              <p className="text-sm font-semibold text-rose-700">{challengeError}</p>
              <Button type="button" variant="secondary" className="mt-4" onClick={requestChallenge}>
                Tạo lại yêu cầu xác thực
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-cyan-700" />
          <h2 className="mt-3 text-base font-black text-slate-950">Khuôn mặt đã được xác thực</h2>
          <p className="mt-2 text-sm font-semibold text-slate-600">
            Kết nối ví mới và ký thông điệp để chứng minh bạn sở hữu ví đó.
          </p>
          <Button type="button" size="lg" className="mt-5 w-full" onClick={handleNewWallet} loading={busy} disabled={busy}>
            <Wallet className="h-4 w-4" />
            Kết nối ví mới
          </Button>
        </div>
      )}

      <Button type="button" variant="secondary" size="lg" className="w-full" onClick={onBack} disabled={busy}>
        <ArrowLeft className="h-4 w-4" />
        Quay lại đăng nhập
      </Button>
    </div>
  );
}

function PasswordInput({ id, label, value, onChange, visible, onToggle, disabled }) {
  return (
    <FormField label={label} htmlFor={id}>
      <div className="relative">
        <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Tối thiểu 8 ký tự"
          required
          type={visible ? 'text' : 'password'}
          disabled={disabled}
          minLength={8}
          className="pl-10 pr-10"
        />
        <button
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 transition-colors hover:text-cyan-700"
          type="button"
          onClick={onToggle}
          disabled={disabled}
          aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </FormField>
  );
}

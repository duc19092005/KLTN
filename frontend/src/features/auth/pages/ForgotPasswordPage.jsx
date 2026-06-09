import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, ScanFace, User } from 'lucide-react';
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
          <h1 className="text-2xl font-black tracking-tight text-slate-950">Khôi phục mật khẩu</h1>
          <p className="mt-2 text-sm font-semibold text-slate-500">Xác thực sinh trắc học trước khi đặt mật khẩu mới.</p>
        </div>

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
      </section>
    </main>
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

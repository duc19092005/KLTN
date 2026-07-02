import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { authService } from '../apis/authService';
import { useAuth } from '../../../providers/AuthProvider';
import { useToast } from '../../../providers/ToastProvider';
import { getDashboardRoute } from '../../../shared/constants/roleRoutes';
import { Button, FormField, Input } from '../../../shared/components/ui';

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { updateSession } = useAuth();

  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState({ current: false, next: false, confirm: false });

  const submit = async (event) => {
    event.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp.');
      return;
    }
    setBusy(true);
    try {
      const result = await authService.changePassword(form.currentPassword, form.newPassword);

      if (result.data.user) updateSession(result.data.user);

      toast.success('Đổi mật khẩu thành công.');
      navigate(getDashboardRoute(result.data.user?.role || 'RECEPTIONIST'), { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Không đổi được mật khẩu.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10 text-slate-950">
      <section className="w-full max-w-[480px] rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950">Đổi mật khẩu bắt buộc</h1>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-500">
            Đây là lần đăng nhập đầu tiên. Vui lòng đổi mật khẩu trước khi tiếp tục.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <PasswordInput
            id="current-password"
            label="Mật khẩu hiện tại"
            value={form.currentPassword}
            visible={visible.current}
            onToggle={() => setVisible((state) => ({ ...state, current: !state.current }))}
            onChange={(value) => setForm({ ...form, currentPassword: value })}
            disabled={busy}
          />
          <PasswordInput
            id="new-password"
            label="Mật khẩu mới"
            value={form.newPassword}
            visible={visible.next}
            onToggle={() => setVisible((state) => ({ ...state, next: !state.next }))}
            onChange={(value) => setForm({ ...form, newPassword: value })}
            disabled={busy}
          />
          <PasswordInput
            id="confirm-password"
            label="Nhập lại mật khẩu mới"
            value={form.confirmPassword}
            visible={visible.confirm}
            onToggle={() => setVisible((state) => ({ ...state, confirm: !state.confirm }))}
            onChange={(value) => setForm({ ...form, confirmPassword: value })}
            disabled={busy}
          />

          <Button
            type="submit"
            size="lg"
            className="w-full"
            loading={busy}
            disabled={busy || !form.currentPassword || !form.newPassword || !form.confirmPassword}
          >
            Đổi mật khẩu và tiếp tục
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
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
          placeholder="Nhập mật khẩu"
          required
          type={visible ? 'text' : 'password'}
          disabled={disabled}
          minLength={6}
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

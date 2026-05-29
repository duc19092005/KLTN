import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../apis/authService';
import { useAuth } from '../../../providers/AuthProvider';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const { updateSession } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (form.newPassword !== form.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    setBusy(true);
    try {
      const result = await authService.changePassword(form.currentPassword, form.newPassword);
      updateSession(result.data.user || { firstLogin: false });
      navigate('/authenticate', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Không đổi được mật khẩu.');
    } finally {
      setBusy(false);
    }
  };

  return <main className="min-h-screen w-full flex items-center justify-center bg-[#F4F7FA] p-4"><form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-8 shadow-sm space-y-5"><div><p className="text-[11px] font-black text-blue-600 uppercase tracking-[0.22em] mb-2">First login security</p><h1 className="text-2xl font-black text-slate-950">Đổi mật khẩu bắt buộc</h1><p className="mt-2 text-sm text-slate-500">Đây là lần đăng nhập đầu tiên. Vui lòng đổi mật khẩu trước khi đăng ký/xác thực khuôn mặt.</p></div>{error && <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}<Input id="current-password" label="Mật khẩu hiện tại" type="password" value={form.currentPassword} onChange={(v) => setForm({ ...form, currentPassword: v })} /><Input id="new-password" label="Mật khẩu mới" type="password" value={form.newPassword} onChange={(v) => setForm({ ...form, newPassword: v })} /><Input id="confirm-password" label="Nhập lại mật khẩu mới" type="password" value={form.confirmPassword} onChange={(v) => setForm({ ...form, confirmPassword: v })} /><button disabled={busy || !form.currentPassword || !form.newPassword || !form.confirmPassword} className="w-full rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-60">{busy ? <LoadingIndicator size="sm" tone="white" /> : 'Đổi mật khẩu và tiếp tục'}</button></form></main>;
}
function Input({ id, label, type, value, onChange }) { return <label htmlFor={id} className="block space-y-1.5"><span className="text-sm font-bold text-slate-700">{label}</span><input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} required minLength={6} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" /></label>; }

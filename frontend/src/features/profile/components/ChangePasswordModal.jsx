import React, { useState } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';
import { authService } from '../../auth/apis/authService';
import { useToast } from '../../../providers/ToastProvider';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';

/**
 * In-place password change for already-active staff roles (RECEPTIONIST, DOCTOR,
 * LAB_MANAGER). Unlike the first-login ChangePasswordPage, this does
 * NOT redirect — the user stays on their profile after success. Admins are never
 * shown this (they authenticate by wallet and have no password).
 */
export default function ChangePasswordModal({ onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (form.newPassword.length < 6) {
      toast.error('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (form.newPassword === form.currentPassword) {
      toast.error('Mật khẩu mới phải khác mật khẩu hiện tại.');
      return;
    }
    setBusy(true);
    try {
      await authService.changePassword(form.currentPassword, form.newPassword);
      toast.success('Đổi mật khẩu thành công!');
      onClose?.();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Không đổi được mật khẩu.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={busy ? undefined : onClose} />
      <form
        onSubmit={submit}
        className="relative z-10 w-full max-w-md rounded-2xl border border-slate-100 bg-white p-7 shadow-xl space-y-5"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-black text-cyan-600 uppercase tracking-[0.22em] mb-1.5">Bảo mật tài khoản</p>
            <h2 className="text-xl font-black text-slate-950">Đổi mật khẩu</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>

        <Input id="cp-current" label="Mật khẩu hiện tại" value={form.currentPassword} onChange={(v) => setForm({ ...form, currentPassword: v })} />
        <Input id="cp-new" label="Mật khẩu mới" value={form.newPassword} onChange={(v) => setForm({ ...form, newPassword: v })} />
        <Input id="cp-confirm" label="Nhập lại mật khẩu mới" value={form.confirmPassword} onChange={(v) => setForm({ ...form, confirmPassword: v })} />

        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl px-4 py-2.5 text-sm font-black text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={busy || !form.currentPassword || !form.newPassword || !form.confirmPassword}
            className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-black text-white hover:bg-cyan-700 disabled:opacity-60 flex items-center gap-2"
          >
            {busy ? <LoadingIndicator size="sm" tone="white" /> : 'Cập nhật mật khẩu'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Input({ id, label, value, onChange }) {
  const [show, setShow] = useState(false);
  return (
    <label htmlFor={id} className="block space-y-1.5">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          minLength={6}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-11 text-sm outline-none focus:border-cyan-400 focus:bg-white focus:ring-2 focus:ring-cyan-100"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-cyan-600"
          aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        >
          {show ? <EyeOff className="w-5 h-5" strokeWidth={1.8} /> : <Eye className="w-5 h-5" strokeWidth={1.8} />}
        </button>
      </div>
    </label>
  );
}

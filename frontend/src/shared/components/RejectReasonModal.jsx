import React, { useEffect, useRef, useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

const MAX_LEN = 500;

/**
 * Reusable modal for capturing an optional rejection reason.
 *
 * Props:
 *  - open: boolean — whether the modal is visible
 *  - title: string — heading text
 *  - subtitle: string — optional descriptive line (e.g. who/what is being rejected)
 *  - onConfirm: (reason: string) => Promise<void> | void
 *  - onClose: () => void
 *  - confirmLabel: string (default "Xác nhận từ chối")
 */
export default function RejectReasonModal({
  open,
  title = 'Từ chối ca trực',
  subtitle,
  onConfirm,
  onClose,
  confirmLabel = 'Xác nhận từ chối',
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (open) {
      setReason('');
      setSubmitting(false);
      // Focus the textarea shortly after the modal mounts.
      const t = setTimeout(() => textareaRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape' && !submitting) onClose?.();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, submitting, onClose]);

  if (!open) return null;

  const tooLong = reason.length > MAX_LEN;

  async function handleConfirm() {
    if (tooLong || submitting) return;
    setSubmitting(true);
    try {
      await onConfirm?.(reason.trim());
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose?.();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-950">{title}</h3>
              {subtitle && <p className="mt-0.5 text-xs font-semibold text-slate-500">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={() => !submitting && onClose?.()}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          <label className="mb-1.5 block text-xs font-bold text-slate-600">
            Lý do từ chối <span className="font-semibold text-slate-400">(tùy chọn)</span>
          </label>
          <textarea
            ref={textareaRef}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="Nhập lý do để nhân viên hiểu vì sao ca trực bị từ chối..."
            className={`w-full resize-none rounded-xl border px-3 py-2.5 text-sm font-semibold outline-none transition-colors focus:ring-1 ${
              tooLong
                ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-400'
                : 'border-slate-200 focus:border-cyan-400 focus:ring-cyan-400'
            }`}
          />
          <div className="mt-1 flex items-center justify-between">
            <p className={`text-[11px] font-bold ${tooLong ? 'text-rose-500' : 'text-slate-400'}`}>
              {tooLong ? 'Lý do không được vượt quá 500 ký tự.' : 'Để trống nếu không cần ghi lý do.'}
            </p>
            <span className={`text-[11px] font-bold ${tooLong ? 'text-rose-500' : 'text-slate-400'}`}>
              {reason.length}/{MAX_LEN}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-slate-100 p-5">
          <button
            type="button"
            onClick={() => !submitting && onClose?.()}
            disabled={submitting}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || tooLong}
            className="flex-1 rounded-xl bg-rose-600 py-2.5 text-xs font-black text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Đang xử lý...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

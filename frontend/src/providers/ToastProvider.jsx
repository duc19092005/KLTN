import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const success = useCallback((msg, dur) => addToast(msg, 'success', dur), [addToast]);
  const error = useCallback((msg, dur) => addToast(msg, 'error', dur), [addToast]);
  const info = useCallback((msg, dur) => addToast(msg, 'info', dur), [addToast]);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ success, error, info, addToast }}>
      {children}
      <style>{`
        @keyframes toast-in {
          from {
            transform: translateY(-8px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>

      <div className="fixed right-4 top-4 z-[9999] flex w-full max-w-sm flex-col gap-3 p-2 pointer-events-none sm:right-5 sm:top-5 sm:p-0">
        {toasts.map((toast) => {
          let bg = 'bg-white border-slate-200 text-slate-800 shadow-sm';
          let iconColor = 'text-cyan-500';
          let Icon = Info;

          if (toast.type === 'success') {
            bg = 'bg-emerald-50 border-emerald-200 text-emerald-900 shadow-sm';
            iconColor = 'text-emerald-500';
            Icon = CheckCircle2;
          } else if (toast.type === 'error') {
            bg = 'bg-rose-50 border-rose-200 text-rose-950 shadow-sm';
            iconColor = 'text-rose-500';
            Icon = XCircle;
          }

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-4 transition-colors duration-200 ${bg}`}
              style={{
                animation: 'toast-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards',
              }}
              role="status"
            >
              <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${iconColor}`} strokeWidth={2} />
              <div className="flex-1 text-sm font-semibold leading-relaxed">
                {toast.message}
              </div>
              <button
                onClick={() => remove(toast.id)}
                className="mt-0.5 rounded-lg p-1 text-slate-400 transition-colors hover:bg-white/70 hover:text-slate-600"
                aria-label="Đóng thông báo"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

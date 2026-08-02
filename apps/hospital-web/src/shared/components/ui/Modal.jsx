import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import Button from './Button';
import { cn } from './cn';

export default function Modal({ open = true, title, subtitle, children, footer, onClose, maxWidth = 'max-w-2xl', className = '' }) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open || typeof document === 'undefined' || !document.body) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 outline-none animate-fadeIn">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <section className={cn('relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white text-slate-800 shadow-2xl outline-none', maxWidth, className)}>
        {(title || subtitle || onClose) && (
          <header className="flex items-start justify-between gap-4 border-b border-slate-100 p-6">
            <div>
              {title && <h2 className="text-xl font-bold tracking-tight text-slate-900">{title}</h2>}
              {subtitle && <p className="mt-1 text-xs font-semibold text-slate-400">{subtitle}</p>}
            </div>
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Đóng">
                <X className="h-4 w-4 text-slate-500" />
              </Button>
            )}
          </header>
        )}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2.5 border-t border-slate-100 p-5 bg-slate-50">{footer}</footer>}
      </section>
    </div>,
    document.body
  );
}

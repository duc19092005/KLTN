import React, { useEffect } from 'react';
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <section className={cn('relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl', maxWidth, className)}>
        {(title || subtitle || onClose) && (
          <header className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
            <div>
              {title && <h2 className="text-lg font-black text-slate-950">{title}</h2>}
              {subtitle && <p className="mt-1 text-sm font-semibold text-slate-500">{subtitle}</p>}
            </div>
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Dong">
                <X className="h-5 w-5" />
              </Button>
            )}
          </header>
        )}
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-100 p-5">{footer}</footer>}
      </section>
    </div>
  );
}

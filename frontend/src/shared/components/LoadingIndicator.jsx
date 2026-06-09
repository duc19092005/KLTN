import React from 'react';

const sizeClasses = {
  xs: 'w-4 h-4 border-2',
  sm: 'w-5 h-5 border-2',
  md: 'w-8 h-8 border-[3px]',
  lg: 'w-12 h-12 border-4',
};

const toneClasses = {
  cyan: 'border-slate-200 border-t-cyan-600',
  white: 'border-white/35 border-t-white',
  slate: 'border-slate-200 border-t-slate-700',
  emerald: 'border-emerald-100 border-t-emerald-600',
};

/**
 * Shared clinical loading indicator for the whole frontend.
 * Use this instead of custom animate-spin markup in pages/components.
 */
export default function LoadingIndicator({
  size = 'sm',
  tone = 'cyan',
  label,
  className = '',
  labelClassName = '',
  fullScreen = false,
}) {
  const spinner = (
    <div
      role="status"
      aria-label={label || 'Đang tải'}
      className={`shrink-0 rounded-full animate-spin shadow-sm ${sizeClasses[size] || sizeClasses.sm} ${toneClasses[tone] || toneClasses.cyan} ${className}`}
    />
  );

  if (fullScreen) {
    return (
      <main className="min-h-screen w-full flex flex-col items-center justify-center gap-4 bg-[#F4F7FA] font-sans antialiased selection:bg-cyan-100 selection:text-cyan-700">
        {spinner}
        {label && <p className={`text-sm font-bold text-slate-600 tracking-tight ${labelClassName}`}>{label}</p>}
      </main>
    );
  }

  if (!label) return spinner;

  return (
    <div className="inline-flex items-center justify-center gap-2">
      {spinner}
      <span className={`text-sm font-semibold tracking-tight ${labelClassName}`}>{label}</span>
    </div>
  );
}

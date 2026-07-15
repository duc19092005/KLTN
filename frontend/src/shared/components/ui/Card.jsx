import React from 'react';
import { cn } from './cn';

export default function Card({ as: Component = 'section', title, subtitle, action, children, className = '', bodyClassName = '' }) {
  return (
    <Component className={cn('ui-card rounded-2xl border border-slate-200 bg-white shadow-sm', className)}>
      {(title || subtitle || action) && (
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {title && <h2 className="text-lg font-black text-slate-950">{title}</h2>}
            {subtitle && <p className="mt-1 text-sm font-semibold text-slate-500">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={cn(title || subtitle || action ? 'p-5' : '', bodyClassName)}>{children}</div>
    </Component>
  );
}

export function PageHeader({ eyebrow, title, subtitle, actions, className = '' }) {
  return (
    <section className={cn('ui-page-header rounded-2xl border border-slate-200 bg-white p-5 shadow-sm', className)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          {eyebrow && <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-700">{eyebrow}</p>}
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">{title}</h1>
          {subtitle && <p className="mt-1 max-w-3xl text-sm font-semibold leading-relaxed text-slate-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </section>
  );
}

export function StatCard({ label, value, hint, tone = 'cyan', icon, className = '' }) {
  const toneMap = {
    cyan: 'border-cyan-100 bg-cyan-50 text-cyan-700',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    rose: 'border-rose-100 bg-rose-50 text-rose-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
  };
  return (
    <article className={cn('rounded-2xl border p-4 shadow-sm', toneMap[tone] || toneMap.cyan, className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-black uppercase tracking-wider opacity-80">{label}</span>
        {icon}
      </div>
      <strong className="mt-2 block text-2xl font-black text-slate-950">{value}</strong>
      {hint && <p className="mt-1 text-xs font-bold opacity-80">{hint}</p>}
    </article>
  );
}

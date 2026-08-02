import React from 'react';
import { cn } from './cn';

const controlBase = 'ui-field w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400';

export function FormField({ label, htmlFor, hint, error, children, className = '' }) {
  return (
    <label htmlFor={htmlFor} className={cn('block space-y-1.5', className)}>
      {label && <span className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</span>}
      {children}
      {error ? (
        <span className="block text-xs font-bold text-rose-600">{error}</span>
      ) : hint ? (
        <span className="block text-xs font-semibold text-slate-400">{hint}</span>
      ) : null}
    </label>
  );
}

export function Input({ className = '', ...props }) {
  return <input className={cn(controlBase, className)} {...props} />;
}

export function Select({ className = '', children, ...props }) {
  return (
    <select className={cn(controlBase, className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className = '', rows = 4, ...props }) {
  return <textarea rows={rows} className={cn(controlBase, 'resize-none', className)} {...props} />;
}

export function SearchInput({ className = '', ...props }) {
  return <Input className={cn('bg-slate-50 focus:bg-white', className)} {...props} />;
}

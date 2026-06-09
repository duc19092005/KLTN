import React from 'react';
import LoadingIndicator from '../LoadingIndicator';
import { cn } from './cn';

const VARIANTS = {
  primary: 'border-transparent bg-cyan-600 text-white shadow-sm hover:bg-cyan-700 focus-visible:ring-cyan-500',
  secondary: 'border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:ring-cyan-500',
  outline: 'border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100 focus-visible:ring-cyan-500',
  danger: 'border-transparent bg-rose-600 text-white shadow-sm hover:bg-rose-700 focus-visible:ring-rose-500',
  dangerSoft: 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 focus-visible:ring-rose-500',
  ghost: 'border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-cyan-500',
  dark: 'border-transparent bg-cyan-600 text-white shadow-sm hover:bg-cyan-700 focus-visible:ring-cyan-500',
};

const SIZES = {
  xs: 'h-8 px-3 text-[11px]',
  sm: 'h-9 px-3.5 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-sm',
  icon: 'h-10 w-10 p-0',
};

export default function Button({
  as: Component = 'button',
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  type,
  ...props
}) {
  const isButton = Component === 'button';
  return (
    <Component
      type={isButton ? (type || 'button') : undefined}
      disabled={isButton ? disabled || loading : undefined}
      aria-disabled={!isButton && (disabled || loading) ? true : undefined}
      className={cn(
        'ui-btn inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border font-black transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
        VARIANTS[variant] || VARIANTS.primary,
        SIZES[size] || SIZES.md,
        className,
      )}
      {...props}
    >
      {loading ? <LoadingIndicator size="sm" tone={variant === 'secondary' || variant === 'ghost' || variant === 'outline' ? 'cyan' : 'white'} /> : children}
    </Component>
  );
}

export function IconButton({ label, children, className = '', variant = 'secondary', ...props }) {
  return (
    <Button variant={variant} size="icon" aria-label={label} title={label} className={className} {...props}>
      {children}
    </Button>
  );
}

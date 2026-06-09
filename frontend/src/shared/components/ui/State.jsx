import React from 'react';
import { AlertCircle, Inbox } from 'lucide-react';
import LoadingIndicator from '../LoadingIndicator';
import Button from './Button';
import { cn } from './cn';

export function EmptyState({ title = 'Không có dữ liệu', description, action, className = '' }) {
  return (
    <div className={cn('ui-empty rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center', className)}>
      <Inbox className="mx-auto h-8 w-8 text-slate-300" strokeWidth={1.8} />
      <strong className="mt-3 block text-sm font-black text-slate-800">{title}</strong>
      {description && <p className="mt-1 text-sm font-semibold text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = 'Không tải được dữ liệu', message, onRetry, className = '' }) {
  return (
    <div className={cn('ui-error rounded-2xl border border-rose-100 bg-rose-50 p-5 text-rose-700', className)}>
      <div className="flex gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <strong className="block text-sm font-black">{title}</strong>
          {message && <p className="mt-1 text-sm font-semibold">{message}</p>}
          {onRetry && <Button variant="dangerSoft" size="sm" className="mt-3" onClick={onRetry}>Thử lại</Button>}
        </div>
      </div>
    </div>
  );
}

export function LoadingState({ label = 'Đang tải dữ liệu...', className = '' }) {
  return (
    <div className={cn('grid min-h-40 place-items-center rounded-2xl border border-slate-100 bg-white p-8', className)}>
      <LoadingIndicator size="lg" label={label} />
    </div>
  );
}

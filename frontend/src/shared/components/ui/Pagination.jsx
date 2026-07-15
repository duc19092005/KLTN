import React from 'react';
import Button from './Button';
import { cn } from './cn';

export default function Pagination({ page = 1, totalPages = 1, onPageChange, className = '' }) {
  if (!totalPages || totalPages <= 1) return null;
  const canPrev = page > 1;
  const canNext = page < totalPages;
  return (
    <nav className={cn('ui-pagination flex flex-wrap items-center justify-end gap-2', className)} aria-label="Phan trang">
      <Button variant="secondary" size="sm" disabled={!canPrev} onClick={() => canPrev && onPageChange?.(page - 1)}>
        Trước
      </Button>
      <span className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600">
        Trang {page}/{totalPages}
      </span>
      <Button variant="secondary" size="sm" disabled={!canNext} onClick={() => canNext && onPageChange?.(page + 1)}>
        Sau
      </Button>
    </nav>
  );
}

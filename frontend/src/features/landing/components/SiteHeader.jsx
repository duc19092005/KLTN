import React, { useState } from 'react';
import { HeartPulse, LogIn, Menu, Search, X } from 'lucide-react';
import { Button, SearchInput } from '../../../shared/components/ui';
import { NAV_LINKS } from '../data/homeContent';

export default function SiteHeader({ onOpenStaffLogin, onSearch }) {
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const submitSearch = (event) => {
    event.preventDefault();
    onSearch?.(query.trim());
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6 lg:px-8">
        <a href="#top" className="flex min-h-11 min-w-0 shrink-0 items-center gap-2.5 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-800 text-white shadow-sm" aria-hidden>
            <HeartPulse className="h-5 w-5" strokeWidth={2.25} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold tracking-tight text-slate-900 sm:text-base">
              BVĐK Quốc tế KLTN
            </span>
            <span className="hidden text-xs font-semibold text-slate-600 sm:block">
              An tâm từng bước
            </span>
          </span>
        </a>

        <form onSubmit={submitSearch} className="hidden min-w-0 flex-1 md:block" role="search">
          <label htmlFor="home-quick-search" className="sr-only">
            Tìm kiếm nhanh chuyên khoa hoặc dịch vụ
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
            <SearchInput
              id="home-quick-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm chuyên khoa, bác sĩ, dịch vụ…"
              className="h-11 border-slate-300 bg-slate-50 pl-10 text-base font-semibold text-slate-900 placeholder:text-slate-500 focus:border-blue-700 focus:ring-blue-100"
            />
          </div>
        </form>

        <nav className="ml-auto hidden items-center gap-1 lg:flex" aria-label="Điều hướng chính">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-bold text-slate-700 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button
            as="a"
            href="#dat-lich"
            variant="primary"
            size="lg"
            className="hidden min-h-11 bg-blue-800 px-4 text-sm font-bold hover:bg-blue-900 focus-visible:ring-blue-700 sm:inline-flex"
          >
            Đặt lịch nhanh
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={onOpenStaffLogin}
            className="min-h-11 min-w-11 px-3 sm:px-4"
            aria-label="Đăng nhập cổng nhân sự"
          >
            <LogIn className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Nhân sự</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11 lg:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {menuOpen && (
        <div id="mobile-nav" className="border-t border-slate-200 bg-white px-4 py-4 lg:hidden">
          <form onSubmit={submitSearch} className="mb-3" role="search">
            <label htmlFor="home-quick-search-mobile" className="sr-only">Tìm kiếm nhanh</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
              <SearchInput
                id="home-quick-search-mobile"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm chuyên khoa, bác sĩ…"
                className="h-12 border-slate-300 bg-slate-50 pl-10 text-base font-semibold"
              />
            </div>
          </form>
          <nav className="flex flex-col gap-1" aria-label="Điều hướng mobile">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="inline-flex min-h-12 items-center rounded-xl px-3 text-base font-bold text-slate-800 hover:bg-slate-100"
              >
                {link.label}
              </a>
            ))}
            <a
              href="#dat-lich"
              onClick={() => setMenuOpen(false)}
              className="mt-2 inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-800 px-4 text-base font-bold text-white hover:bg-blue-900"
            >
              Đặt lịch nhanh
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}

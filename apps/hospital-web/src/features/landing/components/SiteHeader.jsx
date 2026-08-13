import React, { useEffect, useRef, useState } from 'react';
import { NAV_LINKS } from '../data/homeContent';
import { Search, PhoneCall, LogIn, Menu, X } from 'lucide-react';

export default function SiteHeader({ onOpenStaffLogin, onSearch }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleNavClick = (e, href) => {
    if (href.startsWith('#')) {
      e.preventDefault();
      const targetId = href.replace('#', '');
      const element = document.getElementById(targetId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      setMenuOpen(false);
    }
  };

  const submitSearch = (event) => {
    event.preventDefault();
    onSearch?.(query.trim());
    setSearchOpen(false);
  };

  return (
    <header
      className={`fixed top-0 left-0 z-50 w-full transition-all duration-200 antialiased ${
        scrolled ? 'border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-2xs py-0' : 'bg-white border-b border-slate-100'
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 sm:px-8">
        {/* Brand Logo */}
        <a
          href="#top"
          onClick={(e) => handleNavClick(e, '#top')}
          className="flex items-center gap-2.5 shrink-0 group"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-600 text-lg font-bold text-white shadow-2xs group-hover:bg-sky-700 transition-all">
            K
          </div>
          <div className="leading-tight">
            <div className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-sky-600 transition-colors whitespace-nowrap">
              Bệnh Viện Đa Khoa KLTN
            </div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
              Bệnh viện Đa khoa Quốc tế
            </div>
          </div>
        </a>

        {/* Desktop Navigation Links */}
        <div className="hidden lg:flex items-center gap-5 xl:gap-7">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => handleNavClick(e, link.href)}
              className="text-[11px] font-bold uppercase tracking-wider text-slate-700 hover:text-sky-600 transition-colors whitespace-nowrap px-1 py-1"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-600 transition-all shadow-2xs"
            aria-label={searchOpen ? 'Đóng tìm kiếm' : 'Mở tìm kiếm'}
          >
            <Search className="w-4 h-4" />
          </button>

          <a
            href="tel:19001234"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-sky-50 px-3.5 py-1.5 text-[11px] font-bold text-sky-700 border border-sky-100 hover:bg-sky-100 transition-all whitespace-nowrap"
          >
            <PhoneCall className="w-3.5 h-3.5 text-sky-600" />
            <span>1900 1234</span>
          </a>

          <button
            type="button"
            onClick={onOpenStaffLogin}
            className="hidden xl:inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-slate-800 transition-all shadow-2xs whitespace-nowrap"
            aria-label="Đăng nhập cổng y tế"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Đăng nhập hệ thống</span>
          </button>

          {/* Mobile & Tablet Drawer Menu Button */}
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 lg:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="w-4.5 h-4.5" /> : <Menu className="w-4.5 h-4.5" />}
          </button>
        </div>
      </nav>

      {/* Search Bar Overlay */}
      {searchOpen && (
        <div className="border-t border-slate-200 bg-white shadow-md animate-in fade-in duration-200">
          <form
            onSubmit={submitSearch}
            className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-2.5 sm:px-8"
            role="search"
          >
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              id="home-search"
              name="q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nhập tên bác sĩ, chuyên khoa hoặc dịch vụ y tế (vd: Tim mạch, Bác sĩ An)..."
              autoComplete="off"
              className="h-9 w-full border-0 bg-transparent text-xs font-semibold text-slate-900 outline-none placeholder:text-slate-400"
            />
            <button
              type="submit"
              className="rounded-xl bg-sky-600 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-sky-700 transition-colors"
            >
              Tìm kiếm
            </button>
          </form>
        </div>
      )}

      {/* Mobile & Tablet Drawer Menu */}
      {menuOpen && (
        <div className="border-t border-slate-200 bg-white px-5 py-4 lg:hidden shadow-xl animate-in fade-in duration-200">
          <nav className="flex flex-col gap-1.5">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                className="flex min-h-10 items-center px-3 text-xs font-bold uppercase tracking-wider text-slate-800 rounded-xl hover:bg-sky-50 hover:text-sky-600 transition-colors border-b border-slate-100 last:border-none"
              >
                {link.label}
              </a>
            ))}
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onOpenStaffLogin?.();
              }}
              className="mt-2 flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-slate-900 text-xs font-bold uppercase tracking-wider text-white shadow-2xs"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Đăng nhập hệ thống</span>
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}

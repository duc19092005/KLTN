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
    const onScroll = () => setScrolled(window.scrollY > 30);
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
      className={`fixed top-0 left-0 z-50 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md transition-all duration-300 antialiased ${
        scrolled ? 'shadow-md shadow-slate-900/5' : ''
      }`}
    >
      <nav className="mx-auto flex h-20 max-w-[1280px] items-center justify-between px-4 sm:px-6">
        {/* Brand Logo */}
        <a
          href="#top"
          onClick={(e) => handleNavClick(e, '#top')}
          className="flex items-center gap-3 shrink-0 group"
        >
          <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-2xl bg-sky-600 text-lg sm:text-xl font-bold text-white shadow-lg shadow-sky-600/30 group-hover:bg-sky-700 transition-all">
            K
          </div>
          <div className="leading-tight">
            <div className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-sky-600 transition-colors whitespace-nowrap">
              Bệnh Viện KLTN
            </div>
            <div className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-sky-600 whitespace-nowrap">
              International Hospital
            </div>
          </div>
        </a>

        {/* Desktop Navigation Links */}
        <div className="hidden lg:flex items-center gap-5 xl:gap-7 shrink">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => handleNavClick(e, link.href)}
              className="text-xs font-bold tracking-wide text-slate-700 hover:text-sky-600 transition-colors whitespace-nowrap px-1 py-1"
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
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50 hover:text-sky-600 transition-all shadow-xs"
            aria-label={searchOpen ? 'Đóng tìm kiếm' : 'Mở tìm kiếm'}
          >
            <Search className="w-4 h-4" />
          </button>

          <a
            href="tel:19001234"
            className="hidden sm:inline-flex items-center gap-2 rounded-2xl bg-sky-50 px-4 py-2 text-xs font-bold text-sky-700 border border-sky-200 hover:bg-sky-100 transition-all whitespace-nowrap shadow-xs"
          >
            <PhoneCall className="w-3.5 h-3.5 text-sky-600" />
            <span>1900 1234</span>
          </a>

          <button
            type="button"
            onClick={onOpenStaffLogin}
            className="hidden xl:flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition-all shadow-sm whitespace-nowrap"
            aria-label="Đăng nhập cổng nhân sự"
          >
            <LogIn className="w-4 h-4" />
            <span>Cổng Nhân sự</span>
          </button>

          {/* Mobile & Tablet Drawer Menu Button */}
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 lg:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Search Bar Overlay */}
      {searchOpen && (
        <div className="border-t border-slate-200 bg-white animate-fadeIn">
          <form
            onSubmit={submitSearch}
            className="mx-auto flex max-w-[1280px] items-center gap-3 px-4 py-3 sm:px-6"
            role="search"
          >
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              id="home-search"
              name="q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nhập tên bác sĩ, chuyên khoa hoặc dịch vụ y tế..."
              autoComplete="off"
              className="h-10 w-full border-0 bg-transparent text-xs font-semibold text-slate-900 outline-none placeholder:text-slate-400"
            />
            <button
              type="submit"
              className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-sky-700 transition-colors"
            >
              Tìm kiếm
            </button>
          </form>
        </div>
      )}

      {/* Mobile & Tablet Drawer Menu */}
      {menuOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-4 lg:hidden shadow-lg animate-fadeIn">
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                className="flex min-h-11 items-center px-3 text-xs font-bold text-slate-800 rounded-xl hover:bg-sky-50/50 hover:text-sky-600 transition-colors border-b border-slate-100 last:border-none"
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
              className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-slate-900 text-xs font-bold uppercase tracking-wider text-white"
            >
              <LogIn className="w-4 h-4" />
              <span>Cổng Nhân sự</span>
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}

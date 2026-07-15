import React, { useEffect, useRef, useState } from 'react';
import { NAV_LINKS } from '../data/homeContent';

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
    const onScroll = () => setScrolled(window.scrollY > 50);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const submitSearch = (event) => {
    event.preventDefault();
    onSearch?.(query.trim());
    setSearchOpen(false);
  };

  return (
    <header
      className={`fixed top-0 left-0 z-50 w-full border-b border-[#c3c6d0] bg-[#f7f9fb] transition-shadow duration-200 ${
        scrolled ? 'editorial-shadow' : ''
      }`}
    >
      <nav className="mx-auto flex h-20 max-w-[1280px] items-center justify-between px-4 sm:px-6">
        <a href="#top" className="flex items-center gap-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#001836]">
          <div className="flex h-10 w-10 items-center justify-center bg-[#001836] text-xl font-bold text-white le-display">
            K
          </div>
          <div className="hidden leading-none sm:block">
            <div className="le-display text-2xl font-bold text-[#001836]">Bệnh Viện KLTN</div>
            <div className="mt-1 text-xs font-medium uppercase tracking-normal text-[#43474f]">
              International Hospital
            </div>
          </div>
        </a>

        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link, index) => (
            <a
              key={link.href}
              href={link.href}
              className={`text-sm font-semibold tracking-normal transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#001836] ${
                index === 0
                  ? 'border-b-2 border-[#001836] pb-1 text-[#001836]'
                  : 'text-[#43474f] hover:text-[#001836]'
              }`}
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            className="p-2 text-[#43474f] transition-colors hover:text-[#001836] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#001836]"
            aria-label={searchOpen ? 'Đóng tìm kiếm' : 'Mở tìm kiếm'}
            aria-expanded={searchOpen}
          >
            <span className="material-symbols-outlined" aria-hidden="true">search</span>
          </button>

          <a
            href="#dat-lich"
            className="le-btn hidden bg-[#001836] px-6 py-3 text-sm font-semibold uppercase tracking-normal text-white transition-colors hover:bg-[#002d5b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#001836] sm:inline-flex"
          >
            Đặt lịch khám
          </a>

          <button
            type="button"
            onClick={onOpenStaffLogin}
            className="hidden items-center gap-2 text-sm font-semibold tracking-normal text-[#43474f] transition-colors hover:text-[#001836] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#001836] lg:flex"
            aria-label="Đăng nhập cổng nhân sự"
          >
            <span className="material-symbols-outlined" aria-hidden="true">login</span>
            Nhân sự
          </button>

          <button
            type="button"
            className="p-2 text-[#43474f] md:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#001836]"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              {menuOpen ? 'close' : 'menu'}
            </span>
          </button>
        </div>
      </nav>

      {searchOpen && (
        <div className="border-t border-[#c3c6d0] bg-white">
          <form
            onSubmit={submitSearch}
            className="mx-auto flex max-w-[1280px] items-center gap-3 px-4 py-3 sm:px-6"
            role="search"
          >
            <label htmlFor="home-search" className="sr-only">
              Tìm chuyên khoa hoặc dịch vụ
            </label>
            <span className="material-symbols-outlined text-[#43474f]" aria-hidden="true">search</span>
            <input
              ref={inputRef}
              id="home-search"
              name="q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Chuyên khoa, bác sĩ, dịch vụ…"
              autoComplete="off"
              className="h-11 w-full border-0 bg-transparent text-base text-[#191c1e] outline-none placeholder:text-[#737780] focus:ring-0"
            />
            <button
              type="submit"
              className="le-btn border border-[#001836] px-4 py-2 text-xs font-semibold uppercase tracking-normal text-[#001836] hover:bg-[#001836] hover:text-white"
            >
              Tìm
            </button>
          </form>
        </div>
      )}

      {menuOpen && (
        <div className="border-t border-[#c3c6d0] bg-white px-4 py-4 md:hidden">
          <nav className="flex flex-col" aria-label="Menu mobile">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="flex min-h-12 items-center border-b border-[#e0e3e5] text-sm font-semibold tracking-normal text-[#43474f]"
              >
                {link.label}
              </a>
            ))}
            <a
              href="#dat-lich"
              onClick={() => setMenuOpen(false)}
              className="le-btn mt-4 flex min-h-12 items-center justify-center bg-[#001836] text-sm font-semibold uppercase tracking-normal text-white"
            >
              Đặt lịch khám
            </a>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onOpenStaffLogin?.();
              }}
              className="mt-2 flex min-h-12 items-center justify-center gap-2 text-sm font-semibold text-[#43474f]"
            >
              <span className="material-symbols-outlined" aria-hidden="true">login</span>
              Nhân sự
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}

import React, { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LoginPage } from '../../auth';
import SiteHeader from '../components/SiteHeader';
import HeroSection from '../components/HeroSection';
import QuickActions from '../components/QuickActions';
import SpecialitiesSection from '../components/SpecialitiesSection';
import DoctorsPricingSection from '../components/DoctorsPricingSection';
import BookingCtaSection from '../components/BookingCtaSection';
import SiteFooter from '../components/SiteFooter';

/**
 * Home — BVĐK Quốc tế
 *
 * Stack: Vite + React + Tailwind + shared UI (shadcn-style). Project is not Next.js;
 * sections are split like App Router segments for maintainability.
 *
 * taste-skill dials:
 * - TYPOGRAPHY_ELEVATION: High — bold hierarchy, 16px+ body, strong trust
 * - MOTION_INTENSITY: Low — duration-150, scale ≤ 1.015 on cards only
 * - VISUAL_DENSITY: Medium — spacing scale 4–64, airy but not sparse art-gallery
 *
 * web a11y (healthcare):
 * - WCAG-minded contrast (slate-900 on white / blue-900 CTAs)
 * - Touch targets ≥ 44px
 * - Mobile-first responsive
 * - Medical blue + clean neutrals
 */

export default function HospitalLandingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const showLogin = searchParams.get('login') === 'true';
  const initialMode = searchParams.get('tab') || 'staff';

  const openStaffLogin = useCallback(() => {
    setSearchParams({ login: 'true', tab: 'staff' });
  }, [setSearchParams]);

  const closeLogin = useCallback(() => {
    setSearchParams({});
  }, [setSearchParams]);

  const onSearch = useCallback((query) => {
    if (!query) return;
    const q = query.toLowerCase();
    if (q.includes('bác') || q.includes('bac') || q.includes('doctor')) {
      document.getElementById('doi-ngu')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    if (q.includes('giá') || q.includes('gia') || q.includes('bảng')) {
      document.getElementById('bang-gia')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    if (q.includes('sản') || q.includes('nhi') || q.includes('tim') || q.includes('khớp') || q.includes('ung') || q.includes('khoa')) {
      document.getElementById('chuyen-khoa')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    document.getElementById('dat-lich')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-bold focus:text-slate-900 focus:shadow-lg"
      >
        Bỏ qua đến nội dung chính
      </a>

      <SiteHeader onOpenStaffLogin={openStaffLogin} onSearch={onSearch} />

      <main id="main-content">
        <HeroSection />
        <QuickActions />
        <SpecialitiesSection />
        <DoctorsPricingSection />
        <BookingCtaSection />
      </main>

      <SiteFooter />

      {showLogin && (
        <LoginPage isModal initialMode={initialMode} onClose={closeLogin} />
      )}
    </div>
  );
}

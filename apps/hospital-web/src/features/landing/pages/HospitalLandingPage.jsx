import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LoginPage } from '../../auth';
import SiteHeader from '../components/SiteHeader';
import HeroSection from '../components/HeroSection';
import PatientJourneySection from '../components/PatientJourneySection';
import VisionSection from '../components/VisionSection';
import SpecialitiesSection from '../components/SpecialitiesSection';
import DoctorsSection from '../components/DoctorsSection';
import FacilitiesSection from '../components/FacilitiesSection';
import NewsSection from '../components/NewsSection';
import BookingCtaSection from '../components/BookingCtaSection';
import SideNavProgress from '../components/SideNavProgress';
import SiteFooter from '../components/SiteFooter';
import { ArrowUp } from 'lucide-react';
import '../landing.css';

export default function HospitalLandingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const showLogin = searchParams.get('login') === 'true';
  const initialMode = searchParams.get('tab') || 'staff';
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
    if (q.includes('cơ sở') || q.includes('co so') || q.includes('mri')) {
      document.getElementById('co-so')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    if (
      q.includes('sản')
      || q.includes('nhi')
      || q.includes('tim')
      || q.includes('khớp')
      || q.includes('ung')
      || q.includes('khoa')
    ) {
      document.getElementById('chuyen-khoa')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    document.getElementById('lien-he')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <div className="landing-editorial min-h-screen relative font-sans text-slate-800 antialiased selection:bg-sky-100 selection:text-sky-700">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:border focus:border-slate-900 focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-medium focus:text-slate-900"
      >
        Bỏ qua đến nội dung chính
      </a>

      <SiteHeader onOpenStaffLogin={openStaffLogin} onSearch={onSearch} />

      {/* Side Bar Scroll Status & Navigation Indicator */}
      <SideNavProgress />

      <main id="main-content" className="pt-16">
        <HeroSection />
        <PatientJourneySection />
        <VisionSection />
        <SpecialitiesSection />
        <DoctorsSection />
        <FacilitiesSection />
        <NewsSection />
        <BookingCtaSection />
      </main>

      <SiteFooter />

      {/* Floating Scroll To Top Button */}
      {showScrollTop && (
        <button
          type="button"
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-lg hover:border-sky-500 hover:bg-sky-600 hover:text-white transition-all duration-300 hover:scale-105 active:scale-95 animate-in fade-in"
          aria-label="Cuộn lên đầu trang"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}

      {showLogin && (
        <LoginPage isModal initialMode={initialMode} onClose={closeLogin} />
      )}
    </div>
  );
}

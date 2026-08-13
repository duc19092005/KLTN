import React, { useCallback } from 'react';
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
import '../landing.css';

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

      <main id="main-content" className="pt-20">
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

      {showLogin && (
        <LoginPage isModal initialMode={initialMode} onClose={closeLogin} />
      )}
    </div>
  );
}

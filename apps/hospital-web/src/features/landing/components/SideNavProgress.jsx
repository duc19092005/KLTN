import React, { useEffect, useState } from 'react';
import { Home, HeartHandshake, Stethoscope, Users, CalendarCheck, HelpCircle, PhoneCall } from 'lucide-react';

const SECTIONS = [
  { id: 'top', label: 'Trang chủ', icon: Home },
  { id: 'dich-vu', label: 'Dịch vụ', icon: HeartHandshake },
  { id: 'chuyen-khoa', label: 'Chuyên khoa', icon: Stethoscope },
  { id: 'doi-ngu', label: 'Bác sĩ', icon: Users },
  { id: 'hoi-dap', label: 'Hỏi đáp', icon: HelpCircle },
  { id: 'lien-he', label: 'Đặt lịch', icon: CalendarCheck },
];

export default function SideNavProgress() {
  const [activeId, setActiveId] = useState('top');

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 220;

      for (let i = SECTIONS.length - 1; i >= 0; i--) {
        const sectionEl = document.getElementById(SECTIONS[i].id);
        if (sectionEl) {
          const top = sectionEl.offsetTop;
          if (scrollPosition >= top) {
            setActiveId(SECTIONS[i].id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveId(id);
    }
  };

  return (
    <div
      className="fixed right-4 top-1/2 z-40 hidden -translate-y-1/2 lg:flex pointer-events-auto"
      aria-label="Thanh trạng thái vị trí lướt trang"
    >
      {/* Slim Compact Floating Pill */}
      <div className="flex flex-col items-center gap-2 rounded-full border border-slate-200/90 bg-white/95 py-2.5 px-1.5 shadow-lg shadow-slate-900/5 backdrop-blur-md">
        {SECTIONS.map((sec) => {
          const isActive = activeId === sec.id;
          const Icon = sec.icon;
          return (
            <div key={sec.id} className="group relative flex items-center justify-center">
              {/* Floating Label */}
              <span
                className={`absolute right-10 whitespace-nowrap rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white shadow-md transition-all duration-200 ${
                  isActive
                    ? 'scale-100 opacity-100'
                    : 'scale-90 opacity-0 pointer-events-none group-hover:scale-100 group-hover:opacity-100'
                }`}
              >
                {sec.label}
              </span>

              {/* Compact Circle Button */}
              <button
                type="button"
                onClick={() => scrollToSection(sec.id)}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-all duration-300 cursor-pointer ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/30 scale-110'
                    : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-700'
                }`}
                aria-label={`Cuộn đến ${sec.label}`}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

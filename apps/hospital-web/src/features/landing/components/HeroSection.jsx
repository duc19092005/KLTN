import React from 'react';
import Reveal from './Reveal';

const HERO_IMAGE_HUMAN = 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=1200&q=80';

export default function HeroSection() {
  return (
    <section id="top" className="relative overflow-hidden bg-white pb-20 pt-16" aria-labelledby="hero-heading">
      {/* Background Soft Ambient Glow */}
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-sky-50/70 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-[1280px] px-4 sm:px-6">
        <div className="flex w-full flex-col gap-6">
          {/* Announcement Bar */}
          <Reveal variant="fade" delay={0}>
            <div className="mb-2 flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-100 pb-4 gap-2">
              <div className="flex items-center gap-2.5">
                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Bệnh viện Đa khoa Quốc tế KLTN · Nâng niu sức khỏe gia đình bạn
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
                <span>📍 123 Nguyễn Văn Cừ, Quận 5, TP.HCM</span>
                <span className="hidden md:inline">|</span>
                <span className="hidden md:inline">Hotline Cấp cứu: <strong className="text-rose-600 font-bold">1900 1234</strong></span>
              </div>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
            {/* Left Content */}
            <div className="lg:col-span-7">
              <Reveal variant="up" delay={80}>
                <span className="inline-block rounded-full bg-sky-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-sky-700 mb-4 border border-sky-100">
                  Chăm sóc tận tâm · Tiêu chuẩn Y tế Quốc tế
                </span>
                <h1
                  id="hero-heading"
                  className="hero-title le-display text-[clamp(2.4rem,5vw,3.8rem)] font-bold tracking-tight text-slate-900 leading-[1.2]"
                >
                  Y đức phụng sự,<br />
                  <span className="italic font-normal text-sky-600">đồng hành cùng sự an tâm của bạn.</span>
                </h1>
              </Reveal>

              <Reveal variant="up" delay={160}>
                <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
                  Nơi sự thấu cảm của y bác sĩ luôn đặt sức khỏe người bệnh lên hàng đầu. Đội ngũ chuyên gia sẵn sàng lắng nghe, thăm khám tỉ mỉ và mang đến sự chăm sóc chu đáo nhất cho gia đình bạn.
                </p>
              </Reveal>

              {/* Clean Action Buttons (No complex forms) */}
              <Reveal variant="up" delay={220} className="mt-8">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                  <a
                    href="#chuyen-khoa"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-600 px-8 py-4 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-sky-600/20 hover:bg-sky-700 hover:shadow-xl transition-all"
                  >
                    <span className="material-symbols-outlined text-base">medical_services</span>
                    Khám phá Chuyên khoa
                  </a>
                  <a
                    href="#doi-ngu"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-8 py-4 text-xs font-bold uppercase tracking-wider text-slate-800 hover:border-sky-600 hover:text-sky-600 transition-all shadow-sm"
                  >
                    <span className="material-symbols-outlined text-base">groups</span>
                    Đội ngũ Bác sĩ
                  </a>
                  <a
                    href="tel:19001234"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-50 border border-rose-200 px-6 py-4 text-xs font-bold uppercase tracking-wider text-rose-700 hover:bg-rose-100 transition-all"
                  >
                    <span className="material-symbols-outlined text-base text-rose-600">call</span>
                    Hotline 1900 1234
                  </a>
                </div>
              </Reveal>
            </div>

            {/* Right Side Image Showcase */}
            <div className="lg:col-span-5">
              <Reveal variant="scale" delay={200}>
                <div className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-3 shadow-xl">
                  <div className="relative h-[480px] w-full overflow-hidden rounded-2xl">
                    <img
                      src={HERO_IMAGE_HUMAN}
                      alt="Bác sĩ thăm khám ân cần cho người bệnh"
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      width={1200}
                      height={800}
                      loading="eager"
                      onError={(e) => {
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1200&q=80';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent" />
                    <div className="absolute bottom-6 left-6 right-6 text-white">
                      <div className="flex items-center gap-2 text-xs font-bold text-sky-200 mb-1">
                        <span className="material-symbols-outlined text-sm">favorite</span>
                        Tận tâm vì sức khỏe người bệnh
                      </div>
                      <p className="text-sm font-medium leading-relaxed text-slate-100">
                        "Sức khỏe của bạn là món quà vô giá. Chúng tôi trân trọng và lắng nghe từng nguyện vọng nhỏ nhất."
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

import React from 'react';
import Reveal from './Reveal';
import { HeartPulse, Stethoscope, Users, PhoneCall, ShieldCheck, MapPin, ArrowRight, Award, Sparkles } from 'lucide-react';

const HERO_IMAGE_HUMAN = 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=1200&q=80';

export default function HeroSection() {
  return (
    <section id="top" className="relative overflow-hidden bg-white pb-20 pt-10 antialiased" aria-labelledby="hero-heading">
      {/* Background Soft Ambient Glow */}
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[500px] w-[1000px] -translate-x-1/2 rounded-full bg-sky-50/80 blur-3xl" />
      <div className="pointer-events-none absolute top-1/2 -right-40 h-[400px] w-[400px] rounded-full bg-emerald-50/60 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-[1280px] px-4 sm:px-6">
        <div className="flex w-full flex-col gap-6">
          {/* Announcement Bar */}
          <Reveal variant="fade" delay={0}>
            <div className="mb-2 flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-100 pb-4 gap-2">
              <div className="flex items-center gap-2.5">
                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Bệnh viện Đa khoa Quốc tế KLTN · Nâng niu sức khỏe gia đình bạn
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
                <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-sky-600" /> 123 Nguyễn Văn Cừ, Quận 5, TP.HCM</span>
                <span className="hidden md:inline text-slate-300">|</span>
                <span className="hidden md:inline">Hotline Cấp cứu 24/7: <strong className="text-rose-600 font-extrabold">1900 1234</strong></span>
              </div>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
            {/* Left Content */}
            <div className="lg:col-span-7">
              <Reveal variant="up" delay={80}>
                <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-sky-700 mb-4 border border-sky-100 shadow-xs">
                  <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                  <span>Tiêu chuẩn Y tế Quốc tế · Y Đức Phụng Sự</span>
                </div>
                <h1
                  id="hero-heading"
                  className="hero-title text-[clamp(2.4rem,5vw,3.8rem)] font-extrabold tracking-tight text-slate-900 leading-[1.2]"
                >
                  Chăm sóc sức khỏe toàn diện,<br />
                  <span className="italic font-normal text-sky-600">đồng hành cùng sự an tâm của bạn.</span>
                </h1>
              </Reveal>

              <Reveal variant="up" delay={160}>
                <p className="mt-5 max-w-xl text-base sm:text-lg leading-relaxed text-slate-600 font-medium">
                  Hệ thống y tế thông minh tích hợp công nghệ sinh trắc học và AI chẩn đoán. Đội ngũ y bác sĩ đầu ngành sẵn sàng phục vụ và mang lại trải nghiệm điều trị chu đáo nhất.
                </p>
              </Reveal>

              {/* Action Buttons */}
              <Reveal variant="up" delay={220} className="mt-8">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
                  <a
                    href="#chuyen-khoa"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-600 px-7 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-sky-600/25 hover:bg-sky-700 transition-all hover:scale-[1.02]"
                  >
                    <Stethoscope className="w-4 h-4" />
                    <span>Khám phá Chuyên khoa</span>
                  </a>
                  <a
                    href="#doi-ngu"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-7 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-800 hover:border-sky-600 hover:text-sky-600 transition-all shadow-xs"
                  >
                    <Users className="w-4 h-4" />
                    <span>Đội ngũ Bác sĩ</span>
                  </a>
                  <a
                    href="tel:19001234"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-50 border border-rose-200 px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-rose-700 hover:bg-rose-100 transition-all"
                  >
                    <PhoneCall className="w-4 h-4 text-rose-600" />
                    <span>Hotline 1900 1234</span>
                  </a>
                </div>
              </Reveal>

              {/* Trust Badges */}
              <Reveal variant="up" delay={280} className="mt-10 pt-6 border-t border-slate-100">
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100 shrink-0">
                      <Award className="w-5 h-5" />
                    </div>
                    <div>
                      <strong className="block text-base font-extrabold text-slate-900">100+</strong>
                      <span className="text-[11px] font-semibold text-slate-500">Chuyên gia Y tế</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <strong className="block text-base font-extrabold text-slate-900">99.8%</strong>
                      <span className="text-[11px] font-semibold text-slate-500">Hài lòng điều trị</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 shrink-0">
                      <HeartPulse className="w-5 h-5" />
                    </div>
                    <div>
                      <strong className="block text-base font-extrabold text-slate-900">24/7</strong>
                      <span className="text-[11px] font-semibold text-slate-500">Cấp cứu & Tiếp đón</span>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>

            {/* Right Side Image Showcase */}
            <div className="lg:col-span-5">
              <Reveal variant="scale" delay={200}>
                <div className="group relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-3 shadow-xl">
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
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                    <div className="absolute bottom-6 left-6 right-6 text-white space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-sky-300">
                        <HeartPulse className="w-4 h-4 text-sky-400" />
                        <span>Tận tâm vì sức khỏe người bệnh</span>
                      </div>
                      <p className="text-xs sm:text-sm font-medium leading-relaxed text-slate-200">
                        "Sức khỏe của bạn là món quà vô giá. Chúng tôi trân trọng và đồng hành cùng từng khoảnh khắc bình an của gia đình."
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

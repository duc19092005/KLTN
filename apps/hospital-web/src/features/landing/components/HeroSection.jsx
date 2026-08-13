import React, { useState } from 'react';
import Reveal from './Reveal';
import {
  HeartPulse,
  Stethoscope,
  PhoneCall,
  ShieldCheck,
  MapPin,
  Award,
  Sparkles,
  CalendarCheck,
  Search,
  Clock,
  CheckCircle2,
} from 'lucide-react';

const HERO_IMAGE_HUMAN = 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=1200&q=80';

export default function HeroSection() {
  const [quickSearch, setQuickSearch] = useState('');

  const handleQuickSearch = (e) => {
    e.preventDefault();
    if (!quickSearch.trim()) return;
    const q = quickSearch.toLowerCase();
    if (q.includes('bác') || q.includes('bac') || q.includes('doctor')) {
      document.getElementById('doi-ngu')?.scrollIntoView({ behavior: 'smooth' });
    } else if (q.includes('cơ sở') || q.includes('mri')) {
      document.getElementById('co-so')?.scrollIntoView({ behavior: 'smooth' });
    } else {
      document.getElementById('chuyen-khoa')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section id="top" className="relative overflow-hidden bg-slate-50/50 pb-20 pt-10 antialiased" aria-labelledby="hero-heading">
      <div className="relative z-10 mx-auto max-w-[1400px] px-4 sm:px-8">
        <div className="flex w-full flex-col gap-8">
          
          {/* Top Announcement Strip */}
          <Reveal variant="fade" delay={0}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-200/80 pb-4 gap-3 bg-white rounded-2xl p-4 px-6 shadow-xs">
              <div className="flex items-center gap-3">
                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Bệnh viện Đa khoa Quốc tế KLTN · Y Đức Phụng Sự · Chăm Sóc Sức Khỏe Cho Mọi Nhà
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600">
                <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-sky-600" /> 123 Nguyễn Văn Cừ, Quận 5, TP.HCM</span>
                <span className="hidden md:inline text-slate-300">|</span>
                <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-emerald-600" /> Giờ khám: 07:00 - 17:00 (Thứ 2 - Chủ Nhật)</span>
                <span className="hidden md:inline text-slate-300">|</span>
                <span>Hotline Cấp cứu: <a href="tel:19001234" className="text-rose-600 font-bold hover:underline">1900 1234</a></span>
              </div>
            </div>
          </Reveal>

          {/* Hero Main Grid */}
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-7">
              <Reveal variant="up" delay={80}>
                <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-sky-800 border border-sky-100">
                  <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                  <span>Tận Tâm Thăm Khám · Chu Đáo Đồng Hành</span>
                </div>

                <h1
                  id="hero-heading"
                  className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 leading-snug"
                >
                  Chăm sóc sức khỏe toàn diện,<br />
                  <span className="text-sky-600">
                    Đồng hành cùng sự an tâm của gia đình bạn.
                  </span>
                </h1>
              </Reveal>

              <Reveal variant="up" delay={160}>
                <p className="max-w-2xl text-xs sm:text-sm leading-relaxed text-slate-600 font-medium">
                  Quy tụ hội đồng Bác sĩ Chuyên khoa giàu kinh nghiệm, trang thiết bị y tế hiện đại cùng quy trình thăm khám chu đáo, mang đến trải nghiệm y tế nhẹ nhàng và an tâm tuyệt đối.
                </p>
              </Reveal>

              {/* Action Buttons */}
              <Reveal variant="up" delay={220}>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                  <a
                    href="#lien-he"
                    className="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-sky-600 px-8 py-4 text-xs font-bold uppercase tracking-wider text-white shadow-md hover:bg-sky-700 transition-all"
                  >
                    <CalendarCheck className="w-4.5 h-4.5" />
                    <span>Đặt Lịch Khám Ngay</span>
                  </a>
                  <a
                    href="#chuyen-khoa"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-7 py-4 text-xs font-bold uppercase tracking-wider text-slate-800 hover:border-sky-600 hover:text-sky-600 transition-all shadow-xs"
                  >
                    <Stethoscope className="w-4.5 h-4.5" />
                    <span>Xem Chuyên Khoa</span>
                  </a>
                  <a
                    href="tel:19001234"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-50 border border-rose-200 px-6 py-4 text-xs font-bold uppercase tracking-wider text-rose-700 hover:bg-rose-100 transition-all"
                  >
                    <PhoneCall className="w-4 h-4 text-rose-600" />
                    <span>Cấp cứu 24/7</span>
                  </a>
                </div>
              </Reveal>

              {/* Quick Search Strip */}
              <Reveal variant="up" delay={260}>
                <form onSubmit={handleQuickSearch} className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-xs max-w-xl">
                  <Search className="w-4.5 h-4.5 text-slate-400 ml-3 shrink-0" />
                  <input
                    type="text"
                    value={quickSearch}
                    onChange={(e) => setQuickSearch(e.target.value)}
                    placeholder="Tìm nhanh tên Bác sĩ, Chuyên khoa (vd: Tim mạch, Bác sĩ An)..."
                    className="w-full bg-transparent text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none"
                  />
                  <button
                    type="submit"
                    className="shrink-0 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition"
                  >
                    Tra cứu
                  </button>
                </form>
              </Reveal>

              {/* Medical Trust Stats Strip */}
              <Reveal variant="up" delay={300} className="pt-4 border-t border-slate-200/80">
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100 shrink-0">
                      <Award className="w-5 h-5" />
                    </div>
                    <div>
                      <strong className="block text-lg font-bold text-slate-900">100+</strong>
                      <span className="text-[11px] font-bold text-slate-500">Bác sĩ Chuyên khoa</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <strong className="block text-lg font-bold text-slate-900">99.8%</strong>
                      <span className="text-[11px] font-bold text-slate-500">Bệnh nhân Hài lòng</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 shrink-0">
                      <HeartPulse className="w-5 h-5" />
                    </div>
                    <div>
                      <strong className="block text-lg font-bold text-slate-900">24/7</strong>
                      <span className="text-[11px] font-bold text-slate-500">Cấp cứu & Khám bệnh</span>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>

            {/* Right Showcase Image */}
            <div className="lg:col-span-5">
              <Reveal variant="scale" delay={200}>
                <div className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-3 shadow-xl">
                  <div className="relative h-[500px] w-full overflow-hidden rounded-2xl">
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
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
                    
                    {/* Trust Callout */}
                    <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-xs border border-slate-200 rounded-2xl px-4 py-2.5 shadow-md flex items-center gap-3">
                      <div className="h-8 w-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400">Y Đức Phụng Sự</p>
                        <p className="text-xs font-bold text-slate-900">Bệnh viện Uy tín & Chu đáo</p>
                      </div>
                    </div>

                    <div className="absolute bottom-6 left-6 right-6 text-white space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-sky-300">
                        <HeartPulse className="w-4 h-4 text-sky-400" />
                        <span>Tận tâm phụ sự sức khỏe người bệnh</span>
                      </div>
                      <p className="text-xs sm:text-sm font-medium leading-relaxed text-slate-200">
                        "Sức khỏe của bạn là ưu tiên số một của chúng tôi. Đội ngũ y bác sĩ KLTN luôn sẵn sàng lắng nghe và chăm sóc tận tình nhất."
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

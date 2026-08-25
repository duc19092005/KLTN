import React, { useEffect, useState } from 'react';
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
  Users,
  ChevronRight,
  Star,
  Activity,
} from 'lucide-react';

function useCountUp(targetValue, duration = 1400, delay = 100) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let frameId;
    let startTime = null;

    const timeoutId = setTimeout(() => {
      const step = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 4);
        setCount(Math.round(targetValue * ease));

        if (progress < 1) {
          frameId = requestAnimationFrame(step);
        } else {
          setCount(targetValue);
        }
      };
      frameId = requestAnimationFrame(step);
    }, delay);

    return () => {
      clearTimeout(timeoutId);
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [targetValue, duration, delay]);

  return count;
}

export default function HeroSection() {
  const [quickSearch, setQuickSearch] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('08:30');

  const countPatients = useCountUp(50000, 1600, 200);
  const countSpecialities = useCountUp(15, 1200, 300);
  const countDoctors = useCountUp(80, 1400, 250);

  const handleQuickSearch = (e) => {
    e.preventDefault();
    if (!quickSearch.trim()) return;
    const q = quickSearch.toLowerCase();
    if (q.includes('bác') || q.includes('bac') || q.includes('doctor')) {
      document.getElementById('doi-ngu')?.scrollIntoView({ behavior: 'smooth' });
    } else if (q.includes('hỏi') || q.includes('faq')) {
      document.getElementById('hoi-dap')?.scrollIntoView({ behavior: 'smooth' });
    } else {
      document.getElementById('chuyen-khoa')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const sampleSlots = [
    { time: '08:00', label: 'Sáng', seats: 'Còn 3 chỗ' },
    { time: '08:30', label: 'Sáng', seats: 'Còn 2 chỗ' },
    { time: '09:30', label: 'Sáng', seats: 'Còn 5 chỗ' },
    { time: '14:00', label: 'Chiều', seats: 'Còn 4 chỗ' },
    { time: '15:30', label: 'Chiều', seats: 'Còn 6 chỗ' },
    { time: '17:30', label: 'Ngoài giờ', seats: 'Còn 3 chỗ' },
  ];

  return (
    <section id="top" className="relative overflow-hidden bg-white pb-16 pt-8 sm:pt-12 antialiased" aria-labelledby="hero-heading">
      {/* Background Soft Glow Accents */}
      <div className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-b from-sky-100/60 via-sky-50/30 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-1/3 -z-10 h-72 w-72 rounded-full bg-emerald-50/50 blur-3xl" />

      <div className="mx-auto max-w-[1400px] px-4 sm:px-8">
        <div className="flex flex-col gap-10">
          
          {/* Top Notice Banner */}
          <Reveal variant="fade" delay={0}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border border-slate-200/80 bg-slate-50/80 backdrop-blur-xs rounded-2xl p-3.5 px-6 gap-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-extrabold text-slate-800 tracking-wide">
                  Đang mở cửa nhận bệnh: 07:00 - 20:00 (Thứ 2 đến Chủ Nhật) · Khám ngoài giờ không phụ thu
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600">
                <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-sky-600" /> 123 Nguyễn Văn Cừ, Quận 5, TP.HCM</span>
                <span className="hidden md:inline text-slate-300">|</span>
                <span>Hotline Cấp cứu: <a href="tel:19001234" className="text-rose-600 font-extrabold hover:underline">1900 1234</a></span>
              </div>
            </div>
          </Reveal>

          {/* Hero Main Grid */}
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
            
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6">
              <Reveal variant="up" delay={50}>
                <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-4 py-1.5 text-xs font-extrabold text-sky-800 border border-sky-200/80 shadow-2xs">
                  <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                  <span>Khám Bệnh Nhẹ Nhàng · Tận Tâm Như Người Nhà</span>
                </div>

                <h1
                  id="hero-heading"
                  className="mt-4 text-3xl sm:text-4xl lg:text-[44px] font-black tracking-tight text-slate-900 leading-[1.25]"
                >
                  Chăm sóc sức khỏe chu đáo, <br className="hidden sm:inline" />
                  <span className="bg-gradient-to-r from-sky-600 to-cyan-600 bg-clip-text text-transparent">
                    Đặt lịch trước — Không lo chờ đợi.
                  </span>
                </h1>
              </Reveal>

              <Reveal variant="up" delay={120}>
                <p className="max-w-2xl text-sm sm:text-base leading-relaxed text-slate-600 font-medium">
                  Đội ngũ Bác sĩ chuyên khoa đầu ngành luôn lắng nghe từng triệu chứng, thăm khám kỹ lưỡng và giải thích kết quả cặn kẽ. Quy trình tiếp đón nhanh gọn, giữ chỗ đúng giờ cho cả gia đình bạn.
                </p>
              </Reveal>

              {/* Action Buttons */}
              <Reveal variant="up" delay={180}>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
                  <a
                    href="#lien-he"
                    className="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-sky-600 px-7 py-4 text-xs font-extrabold uppercase tracking-wider text-white shadow-md hover:bg-sky-700 transition-all hover:scale-105 active:scale-95"
                  >
                    <CalendarCheck className="w-4.5 h-4.5" />
                    <span>Đặt Lịch Khám Ngay</span>
                  </a>
                  <a
                    href="#chuyen-khoa"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-4 text-xs font-extrabold uppercase tracking-wider text-slate-700 hover:border-sky-400 hover:text-sky-600 transition-all shadow-2xs hover:bg-slate-50"
                  >
                    <Stethoscope className="w-4.5 h-4.5 text-sky-600" />
                    <span>Xem Các Chuyên Khoa</span>
                  </a>
                  <a
                    href="tel:19001234"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-50 border border-rose-200 px-5 py-4 text-xs font-extrabold uppercase tracking-wider text-rose-700 hover:bg-rose-100 transition-all shadow-2xs"
                  >
                    <PhoneCall className="w-4 h-4 text-rose-600" />
                    <span>1900 1234</span>
                  </a>
                </div>
              </Reveal>

              {/* Quick Search Strip */}
              <Reveal variant="up" delay={220}>
                <form onSubmit={handleQuickSearch} className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-2 shadow-2xs max-w-xl focus-within:bg-white focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-100 transition-all">
                  <Search className="w-4.5 h-4.5 text-slate-400 ml-3 shrink-0" />
                  <input
                    type="text"
                    value={quickSearch}
                    onChange={(e) => setQuickSearch(e.target.value)}
                    placeholder="Tìm nhanh: Đau dạ dày, Khám tim mạch, BS An, Siêu âm..."
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

              {/* Trust Features Badges */}
              <Reveal variant="up" delay={260} className="pt-2">
                <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-xs font-bold text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Thanh toán BHYT đầy đủ
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Kết quả trả nhanh trong ngày
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Miễn phí giữ chỗ trước
                  </span>
                </div>
              </Reveal>
            </div>

            {/* Right Column: Interactive Live Booking & Healthcare Card Widget */}
            <div className="lg:col-span-5">
              <Reveal variant="scale" delay={150}>
                <div className="relative rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-xl shadow-slate-900/5 space-y-6">
                  
                  {/* Card Header: Live Doctor on duty */}
                  <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 font-extrabold border border-sky-200 shadow-2xs">
                        BS
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-sm font-extrabold text-slate-900">Bác sĩ trực hôm nay</strong>
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 border border-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Đang tiếp nhận
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">Khoa Tim mạch · Sản nhi · Cơ xương khớp</p>
                      </div>
                    </div>
                  </div>

                  {/* Slot Selector: Live Availability Preview */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                        Khung giờ hẹn khám còn trống:
                      </label>
                      <span className="text-[11px] font-bold text-sky-600">Hôm nay</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {sampleSlots.map((slot) => {
                        const isSelected = selectedSlot === slot.time;
                        return (
                          <button
                            key={slot.time}
                            type="button"
                            onClick={() => setSelectedSlot(slot.time)}
                            className={`flex flex-col items-center justify-center rounded-xl p-2.5 transition-all border text-center cursor-pointer ${
                              isSelected
                                ? 'border-sky-600 bg-sky-50 text-sky-700 ring-2 ring-sky-200 font-extrabold shadow-xs'
                                : 'border-slate-200 bg-slate-50/60 text-slate-700 hover:border-sky-300 hover:bg-white'
                            }`}
                          >
                            <span className="text-xs font-black font-mono">{slot.time}</span>
                            <span className="text-[10px] font-bold text-slate-400 mt-0.5">{slot.seats}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Fast Confirmation Button */}
                  <a
                    href="#lien-he"
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 to-sky-700 text-xs font-extrabold uppercase tracking-wider text-white shadow-md hover:from-sky-700 hover:to-sky-800 transition-all hover:scale-[1.02] active:scale-98"
                  >
                    <CalendarCheck className="w-4.5 h-4.5" />
                    <span>Giữ chỗ khung giờ {selectedSlot} ngay</span>
                  </a>

                  {/* Patient Review & Trust Score Widget */}
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                        ))}
                        <strong className="text-xs font-black text-slate-900 ml-1">4.9 / 5.0</strong>
                      </div>
                      <span className="text-[11px] font-bold text-slate-400">50.000+ đánh giá</span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium italic leading-relaxed">
                      "Thủ tục nhanh, bác sĩ giải thích rõ ràng và nhân viên niềm nở. Rất an tâm khi đưa gia đình đến khám."
                    </p>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>

          {/* Dynamic Count-Up Statistics Strip */}
          <Reveal variant="up" delay={280}>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 rounded-3xl border border-slate-200/80 bg-slate-50/60 p-6 sm:p-8 shadow-2xs">
              <div className="space-y-1">
                <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Bệnh nhân tin chọn</p>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight">
                  {countPatients.toLocaleString('vi-VN')}+
                </div>
                <p className="text-[11px] font-bold text-emerald-600">Đã khám và điều trị</p>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Tỷ lệ hài lòng</p>
                <div className="text-2xl sm:text-3xl font-black text-sky-600 font-mono tracking-tight">
                  99.2%
                </div>
                <p className="text-[11px] font-bold text-slate-500">Đánh giá 5 sao từ bệnh nhân</p>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Chuyên khoa toàn diện</p>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight">
                  {countSpecialities}+
                </div>
                <p className="text-[11px] font-bold text-slate-500">Phòng khám chuyên khoa</p>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Đội ngũ y bác sĩ</p>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight">
                  {countDoctors}+
                </div>
                <p className="text-[11px] font-bold text-slate-500">Bác sĩ chuyên khoa giàu kinh nghiệm</p>
              </div>
            </div>
          </Reveal>

        </div>
      </div>
    </section>
  );
}

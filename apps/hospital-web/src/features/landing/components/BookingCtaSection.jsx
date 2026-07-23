import React from 'react';
import Reveal from './Reveal';

export default function BookingCtaSection() {
  return (
    <section id="lien-he" className="relative overflow-hidden bg-white py-20 border-t border-slate-100" aria-labelledby="contact-heading">
      <div className="relative z-10 mx-auto max-w-[1280px] px-4 sm:px-6">
        <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-8 sm:p-14 text-white shadow-2xl relative overflow-hidden">
          {/* Ambient Lighting */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-96 w-96 rounded-full bg-sky-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -left-20 -bottom-20 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />

          <div className="relative z-10 grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <Reveal variant="up">
                <span className="inline-block text-xs font-bold uppercase tracking-wider text-sky-400 mb-2">
                  Đồng Hành Cùng Sức Khỏe Gia Đình Bạn
                </span>
                <h2 id="contact-heading" className="le-display text-3xl font-bold sm:text-4xl leading-tight">
                  Bạn cần tư vấn hoặc hỗ trợ thông tin y tế?
                </h2>
                <p className="mt-4 text-base text-slate-300 max-w-2xl leading-relaxed">
                  Đội ngũ nhân viên y tế Bệnh viện KLTN luôn túc trực 24/7 để giải đáp thắc mắc và hỗ trợ bạn một cách nhanh chóng, tận tình nhất.
                </p>
              </Reveal>
            </div>

            <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-4 justify-end">
              <Reveal variant="up" delay={100}>
                <a
                  href="tel:19001234"
                  className="flex items-center justify-center gap-3 rounded-2xl bg-sky-600 px-8 py-4 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-sky-600/30 hover:bg-sky-500 transition-all text-center"
                >
                  <span className="material-symbols-outlined text-lg">call</span>
                  Hotline: 1900 1234
                </a>
              </Reveal>

              <Reveal variant="up" delay={160}>
                <a
                  href="tel:02838111222"
                  className="flex items-center justify-center gap-3 rounded-2xl bg-rose-600/90 border border-rose-500/30 px-8 py-4 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-rose-600/20 hover:bg-rose-600 transition-all text-center"
                >
                  <span className="material-symbols-outlined text-lg">e911_emergency</span>
                  Cấp cứu: (028) 38 111 222
                </a>
              </Reveal>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

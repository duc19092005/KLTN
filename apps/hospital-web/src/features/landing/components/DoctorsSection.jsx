import React from 'react';
import Reveal from './Reveal';
import { DOCTORS } from '../data/homeContent';
import { CalendarCheck, ArrowRight, Award, Sparkles, Stethoscope, HeartHandshake, CheckCircle2 } from 'lucide-react';

export default function DoctorsSection() {
  return (
    <section id="doi-ngu" className="bg-slate-50/50 py-20 border-t border-slate-200/60 antialiased" aria-labelledby="doctors-heading">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-8">
        
        <Reveal variant="up" className="mb-14 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider text-sky-800 mb-3 border border-sky-200/80 shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-sky-600" />
              <span>Y Bác Sĩ Tận Tâm Phục Vụ</span>
            </span>
            <h2 id="doctors-heading" className="text-3xl font-black text-slate-900 sm:text-4xl tracking-tight leading-tight">
              Đội Ngũ Bác Sĩ Giàu Kinh Nghiệm
            </h2>
            <p className="mt-2 text-sm text-slate-600 max-w-xl font-medium leading-relaxed">
              Các bác sĩ chuyên khoa đầu ngành với nhiều năm công tác tại các bệnh viện lớn, luôn lắng nghe và đồng hành tận tình cùng từng người bệnh.
            </p>
          </div>

          <a
            href="#lien-he"
            className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-6 py-3.5 text-xs font-extrabold uppercase tracking-wider text-white shadow-md hover:bg-sky-700 transition-all hover:scale-105"
          >
            <Stethoscope className="w-4 h-4" />
            <span>Đăng ký chọn Bác sĩ</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </Reveal>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {DOCTORS.map((doctor, index) => (
            <Reveal key={doctor.name} variant="up" delay={index * 80}>
              <article className="group flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs hover:border-sky-300 hover:shadow-xl transition-all duration-300">
                <div>
                  {/* Doctor Avatar Badge & Status */}
                  <div className="flex items-center justify-between mb-5">
                    <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border font-black text-sm font-mono shadow-xs ${doctor.color}`}>
                      {doctor.initials}
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200/60">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Nhận khám
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-base sm:text-lg font-extrabold text-slate-900 group-hover:text-sky-600 transition-colors">
                      {doctor.name}
                    </h3>
                    
                    <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-sky-700">
                      <span>{doctor.role}</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-500 font-medium">{doctor.experience}</span>
                    </div>

                    {/* Philosophy Quote */}
                    <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 text-xs text-slate-600 font-medium italic leading-relaxed">
                      "{doctor.philosophy}"
                    </div>
                  </div>
                </div>

                <div className="pt-6">
                  <a
                    href="#lien-he"
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-50 py-3 text-xs font-extrabold uppercase tracking-wider text-sky-700 hover:bg-sky-600 hover:text-white transition-all shadow-2xs group-hover:bg-sky-600 group-hover:text-white"
                  >
                    <CalendarCheck className="w-4 h-4" />
                    <span>Hẹn lịch với Bác sĩ</span>
                  </a>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

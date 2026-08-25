import React from 'react';
import Reveal from './Reveal';
import { SPECIALITIES } from '../data/homeContent';
import {
  Heart,
  Baby,
  Bone,
  Stethoscope,
  ArrowRight,
  ChevronRight,
  Sparkles,
  Smile,
  Eye,
} from 'lucide-react';

const SPEC_ICONS = {
  'tim-mach': Heart,
  'san-phu-nhi': Baby,
  'tieu-hoa-gan-mat': Smile,
  'co-xuong-khop': Bone,
  'tai-mui-hong-ho-hap': Stethoscope,
  'mat-rang-ham-mat': Eye,
};

export default function SpecialitiesSection() {
  return (
    <section id="chuyen-khoa" className="bg-white py-20 border-t border-slate-200/60 antialiased" aria-labelledby="specialities-heading">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-8">
        
        <Reveal variant="up" className="mb-14 text-center max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider text-sky-700 mb-3 border border-sky-200/80 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-sky-600" />
            <span>Phòng Khám Chuyên Khoa</span>
          </span>
          <h2 id="specialities-heading" className="text-3xl font-black text-slate-900 sm:text-4xl tracking-tight leading-tight">
            Chuyên Khoa Thăm Khám & Hướng Dẫn Điều Trị
          </h2>
          <p className="mt-3 text-sm text-slate-600 font-medium leading-relaxed">
            Dễ dàng nhận biết triệu chứng và lựa chọn đúng chuyên khoa để được bác sĩ đầu ngành trực tiếp thăm khám và tư vấn tận tâm.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {SPECIALITIES.map((item, index) => {
            const IconComponent = SPEC_ICONS[item.id] || Stethoscope;
            const isFeatured = item.featured;

            return (
              <Reveal key={item.id} variant="up" delay={index * 80}>
                <div
                  className={`group flex h-full flex-col justify-between rounded-3xl border p-7 transition-all duration-300 ${
                    isFeatured
                      ? 'border-sky-300 bg-gradient-to-br from-white via-sky-50/40 to-cyan-50/30 shadow-md hover:shadow-xl'
                      : 'border-slate-200/80 bg-white shadow-xs hover:border-sky-300 hover:shadow-xl'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 border border-sky-100 shadow-2xs group-hover:bg-sky-600 group-hover:text-white transition-all duration-300">
                        <IconComponent className="w-6 h-6" />
                      </div>
                      {isFeatured && (
                        <span className="rounded-full bg-sky-100 px-3 py-0.5 text-[11px] font-extrabold text-sky-800 border border-sky-200">
                          Khoa trọng điểm
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-extrabold text-slate-900 mb-2 group-hover:text-sky-600 transition-colors">
                      {item.title}
                    </h3>
                    
                    <p className="text-xs text-slate-600 font-medium leading-relaxed mb-4">
                      {item.desc}
                    </p>

                    {/* Symptom Help Box */}
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3 text-[11px] text-slate-600 leading-relaxed">
                      <strong className="text-slate-800 font-bold block mb-1">Khi nào nên đi khám?</strong>
                      <span className="text-slate-500 font-medium">{item.symptoms}</span>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <a
                      href="#lien-he"
                      className="inline-flex items-center gap-1 text-xs font-extrabold text-sky-600 hover:text-sky-700 transition"
                    >
                      <span>Đặt lịch khám khoa này</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </a>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

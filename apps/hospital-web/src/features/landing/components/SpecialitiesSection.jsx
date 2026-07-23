import React from 'react';
import { SPECIALITIES } from '../data/homeContent';
import Reveal from './Reveal';
import { Stethoscope, Heart, Baby, Bone, Activity, ArrowRight, ChevronRight, Sparkles } from 'lucide-react';

const ICON_MAP = {
  favorite: Heart,
  child_care: Baby,
  accessibility_new: Bone,
  ecg_heart: Activity,
  stethoscope: Stethoscope,
};

export default function SpecialitiesSection() {
  return (
    <section id="chuyen-khoa" className="bg-slate-50/50 py-20 border-t border-slate-100 antialiased" aria-labelledby="specialities-heading">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <Reveal variant="up" className="mb-12 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-sky-700 mb-3 border border-sky-100">
            <Sparkles className="w-3.5 h-3.5 text-sky-600" />
            <span>Dịch Vụ Khám Chữa Bệnh</span>
          </span>
          <h2 id="specialities-heading" className="text-3xl font-extrabold text-slate-900 sm:text-4xl tracking-tight">
            Các Chuyên Khoa Trọng Điểm
          </h2>
          <p className="mt-2 text-sm text-slate-500 max-w-xl mx-auto font-medium">
            Hệ thống phòng khám chuyên khoa được đầu tư đồng bộ, trang thiết bị y tế hiện đại sẵn sàng chẩn đoán chính xác.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          {SPECIALITIES.map((item, index) => {
            const IconComponent = ICON_MAP[item.icon] || Stethoscope;
            if (item.featured) {
              return (
                <Reveal
                  key={item.id}
                  variant="up"
                  delay={index * 80}
                  className="md:col-span-2 md:row-span-2"
                >
                  <div className="group flex h-full flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-8 shadow-sm hover:border-sky-300 hover:shadow-xl transition-all duration-300">
                    <div>
                      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white transition-all shadow-xs">
                        <IconComponent className="w-7 h-7" />
                      </div>
                      <h3 className="mb-3 text-2xl font-bold text-slate-900">{item.title}</h3>
                      <p className="mb-6 max-w-sm text-sm leading-relaxed text-slate-600 font-medium">
                        {item.description}
                      </p>
                    </div>
                    <a
                      href="#dat-lich"
                      className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-600 transition-all group-hover:gap-3 group-hover:text-sky-700"
                    >
                      <span>Đăng ký khám ngay</span>
                      <ArrowRight className="w-4 h-4" />
                    </a>
                  </div>
                </Reveal>
              );
            }

            return (
              <Reveal key={item.id} variant="up" delay={index * 80}>
                <div className="group flex h-full flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm hover:border-sky-300 hover:shadow-md transition-all">
                  <div>
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white transition-all shadow-xs">
                      <IconComponent className="w-6 h-6" />
                    </div>
                    <h3 className="mb-2 text-lg font-bold text-slate-900">{item.title}</h3>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">{item.description}</p>
                  </div>
                  <a
                    href="#dat-lich"
                    className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 hover:text-sky-700"
                  >
                    <span>Xem chi tiết</span>
                    <ChevronRight className="w-4 h-4" />
                  </a>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

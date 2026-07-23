import React from 'react';
import { SPECIALITIES } from '../data/homeContent';
import Reveal from './Reveal';

export default function SpecialitiesSection() {
  return (
    <section id="chuyen-khoa" className="bg-white py-20 border-t border-slate-100" aria-labelledby="specialities-heading">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <Reveal variant="up" className="mb-12 text-center">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-sky-600">
            Dịch Vụ Khám Chữa Bệnh
          </span>
          <h2 id="specialities-heading" className="le-display text-3xl font-bold text-slate-900 sm:text-4xl">
            Các Chuyên Khoa Trọng Điểm
          </h2>
          <p className="mt-2 text-sm text-slate-600 max-w-xl mx-auto">
            Hệ thống phòng khám chuyên khoa được đầu tư đồng bộ, sẵn sàng phục vụ và chẩn đoán chính xác.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          {SPECIALITIES.map((item, index) => {
            if (item.featured) {
              return (
                <Reveal
                  key={item.id}
                  variant="up"
                  delay={index * 80}
                  className="md:col-span-2 md:row-span-2"
                >
                  <div className="group flex h-full flex-col justify-between rounded-3xl border border-slate-200 bg-white p-8 shadow-sm hover:border-sky-300 hover:shadow-xl transition-all duration-300">
                    <div>
                      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white transition-colors">
                        <span className="material-symbols-outlined text-3xl">{item.icon}</span>
                      </div>
                      <h3 className="le-display mb-3 text-2xl font-bold text-slate-900">{item.title}</h3>
                      <p className="mb-6 max-w-sm text-sm leading-relaxed text-slate-600">
                        {item.description}
                      </p>
                    </div>
                    <a
                      href="#dat-lich"
                      className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-700 transition-all group-hover:gap-3"
                    >
                      Đăng ký khám ngay
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </a>
                  </div>
                </Reveal>
              );
            }

            return (
              <Reveal key={item.id} variant="up" delay={index * 80}>
                <div className="group flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-sky-300 hover:shadow-md transition-all">
                  <div>
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white transition-colors">
                      <span className="material-symbols-outlined text-2xl">{item.icon}</span>
                    </div>
                    <h3 className="le-display mb-2 text-xl font-bold text-slate-900">{item.title}</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>
                  </div>
                  <a
                    href="#dat-lich"
                    className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-sky-700 hover:text-sky-800"
                  >
                    Xem chi tiết
                    <span className="material-symbols-outlined text-sm">chevron_right</span>
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

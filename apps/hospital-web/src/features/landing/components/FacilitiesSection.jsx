import React from 'react';
import { FACILITIES, FACILITY_IMAGE } from '../data/homeContent';
import Reveal from './Reveal';

export default function FacilitiesSection() {
  return (
    <section id="co-so" className="bg-white py-20 border-t border-slate-100" aria-labelledby="facilities-heading">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <Reveal variant="left">
              <div className="relative">
                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-3 shadow-xl">
                  <div className="aspect-[4/3] overflow-hidden rounded-2xl">
                    <img
                      src={FACILITY_IMAGE}
                      alt="Phòng chẩn đoán hình ảnh MRI hiện đại"
                      className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                      width={640}
                      height={480}
                      loading="lazy"
                    />
                  </div>
                </div>
                <div className="absolute -bottom-6 -right-2 hidden rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-xl md:block">
                  <span className="le-display block text-4xl font-bold text-sky-600">99.8%</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Độ chính xác chẩn đoán
                  </span>
                </div>
              </div>
            </Reveal>
          </div>

          <div className="lg:col-span-6">
            <Reveal variant="right" delay={120}>
              <div>
                <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-sky-600">
                  Trang Thiết Bị Quốc Tế
                </span>
                <h2 id="facilities-heading" className="le-display mb-4 text-3xl font-bold text-slate-900 sm:text-4xl">
                  Cơ sở vật chất hiện đại & Chuẩn y khoa
                </h2>
                <p className="mb-8 text-sm leading-relaxed text-slate-600">
                  Chúng tôi đầu tư đồng bộ hệ thống chẩn đoán hình ảnh thế hệ mới, phòng phẫu thuật vô trùng đạt chuẩn quốc tế giúp tối ưu hóa thời gian khám và phục hồi cho người bệnh.
                </p>
                <div className="space-y-3">
                  {FACILITIES.map((item, i) => (
                    <Reveal key={item.label} variant="up" delay={140 + i * 80}>
                      <div className="flex items-center gap-3.5 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 transition-all hover:bg-white hover:border-sky-200 hover:shadow-sm">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm">
                          <span className="material-symbols-outlined text-xl">{item.icon}</span>
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                          {item.label}
                        </span>
                      </div>
                    </Reveal>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

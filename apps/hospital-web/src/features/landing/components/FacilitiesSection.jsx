import React from 'react';
import { FACILITIES, FACILITY_IMAGE } from '../data/homeContent';
import Reveal from './Reveal';

export default function FacilitiesSection() {
  return (
    <section id="co-so" className="bg-[#001836] py-20 text-white" aria-labelledby="facilities-heading">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <div className="grid grid-cols-1 items-center gap-16 md:grid-cols-2">
          <Reveal variant="left">
            <div className="relative">
              <div className="aspect-square border border-white/20 p-8">
                <img
                  src={FACILITY_IMAGE}
                  alt="Phòng chẩn đoán hình ảnh MRI hiện đại"
                  className="h-full w-full object-cover"
                  width={640}
                  height={640}
                  loading="lazy"
                />
              </div>
              <div className="absolute -bottom-8 -right-4 hidden bg-[#f7f9fb] p-8 text-[#001836] md:block lg:-right-8">
                <span className="le-display block text-5xl sm:text-6xl">99%</span>
                <span className="text-sm font-semibold uppercase tracking-normal">
                  Độ chính xác chẩn đoán
                </span>
              </div>
            </div>
          </Reveal>

          <Reveal variant="right" delay={120}>
            <div>
              <span className="mb-4 block text-xs font-medium uppercase tracking-normal text-[#a1efff]">
                Công nghệ y khoa
              </span>
              <h2 id="facilities-heading" className="le-display mb-6 text-4xl sm:text-5xl">
                Cơ sở vật chất hiện đại bậc nhất
              </h2>
              <p className="mb-10 text-lg leading-[1.6] text-[#d5e3ff]">
                Chúng tôi đầu tư vào những hệ thống chẩn đoán hình ảnh và phẫu thuật robot thế hệ mới
                nhất, giúp rút ngắn thời gian điều trị và tối ưu hóa kết quả phục hồi cho bệnh nhân.
              </p>
              <div className="space-y-0">
                {FACILITIES.map((item, i) => (
                  <Reveal key={item.label} variant="up" delay={160 + i * 90}>
                    <div className="flex items-center gap-4 border-b border-white/10 py-4">
                      <span className="material-symbols-outlined text-[#a1efff]" aria-hidden="true">
                        {item.icon}
                      </span>
                      <span className="text-sm font-semibold uppercase tracking-normal">
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
    </section>
  );
}

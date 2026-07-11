import React from 'react';
import { HERO_IMAGE } from '../data/homeContent';
import Reveal from './Reveal';

export default function HeroSection() {
  return (
    <section id="top" className="relative overflow-hidden bg-[#f7f9fb] pb-20 pt-20" aria-labelledby="hero-heading">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <div className="flex w-full flex-col gap-6">
          <Reveal variant="fade" delay={0}>
            <div className="mb-4 flex items-end justify-between border-b border-[#c3c6d0] pb-4">
              <span className="text-xs font-medium uppercase tracking-normal text-[#43474f]">
                Bệnh viện đa khoa quốc tế KLTN
              </span>
              <span className="text-xs font-medium uppercase tracking-normal text-[#43474f]">
                Est. 2024 · HCMC
              </span>
            </div>
          </Reveal>

          <Reveal variant="up" delay={80}>
            <h1
              id="hero-heading"
              className="hero-title le-display w-full max-w-none text-[clamp(2.5rem,6.5vw,4rem)] font-normal tracking-tight text-[#001836]"
            >
              <span className="block">Chất lượng khám chữa bệnh</span>
              <span className="mt-1 block italic text-[#43474f] sm:mt-2">
                bạn có thể tin tưởng mỗi ngày.
              </span>
            </h1>
          </Reveal>

          <Reveal variant="up" delay={160}>
            <div className="mt-8 flex w-full flex-col gap-12 md:flex-row md:items-center md:justify-between">
              <p className="max-w-md text-lg leading-[1.6] text-[#43474f]">
                Quy trình rõ ràng. Đội ngũ tận tâm. Không gian trầm tĩnh — để bạn và gia đình luôn biết
                mình đang được chăm sóc như thế nào.
              </p>
              <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:gap-8">
                <a
                  href="#dat-lich"
                  className="le-btn inline-flex bg-[#001836] px-8 py-4 text-sm font-semibold uppercase tracking-normal text-white transition-colors hover:bg-[#002d5b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#001836]"
                >
                  Đặt lịch khám
                </a>
                <a
                  href="tel:19001234"
                  className="group flex items-center gap-2 text-sm font-semibold tracking-normal text-[#001836] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#001836]"
                >
                  Hotline cấp cứu 24/7
                  <span className="material-symbols-outlined transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true">
                    north_east
                  </span>
                </a>
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal variant="scale" delay={220} className="mt-16">
          <div className="relative h-[min(70vh,600px)] w-full overflow-hidden">
            <img
              src={HERO_IMAGE}
              alt="Sảnh bệnh viện tối giản, ánh sáng tự nhiên, không gian trầm tĩnh và đáng tin cậy"
              className="image-reveal h-full w-full object-cover"
              width={1600}
              height={600}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              onError={(e) => {
                e.currentTarget.src = '/brand/hospital-hero.jpg';
              }}
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

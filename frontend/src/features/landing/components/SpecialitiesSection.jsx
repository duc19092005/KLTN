import React from 'react';
import { SPECIALITIES } from '../data/homeContent';
import Reveal from './Reveal';

export default function SpecialitiesSection() {
  return (
    <section id="chuyen-khoa" className="bg-[#f7f9fb] py-20" aria-labelledby="specialities-heading">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <Reveal variant="up" className="mb-16 text-center">
          <span className="mb-4 block text-xs font-medium uppercase tracking-normal text-[#00a4b9]">
            Dịch vụ lâm sàng
          </span>
          <h2 id="specialities-heading" className="le-display text-4xl text-[#001836] sm:text-5xl">
            Chuyên khoa mũi nhọn
          </h2>
        </Reveal>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          {SPECIALITIES.map((item, index) => {
            if (item.featured) {
              return (
                <Reveal
                  key={item.id}
                  variant="up"
                  delay={index * 90}
                  className="md:col-span-2 md:row-span-2"
                >
                  <div className="group flex h-full flex-col justify-between border border-[#c3c6d0] bg-white p-10 transition-colors hover:border-[#001836]">
                    <div>
                      <span
                        className="material-symbols-outlined mb-8 text-4xl text-[#001836]"
                        style={{ fontVariationSettings: "'FILL' 1, 'wght' 300, 'GRAD' 0, 'opsz' 24" }}
                        aria-hidden="true"
                      >
                        {item.icon}
                      </span>
                      <h3 className="le-display mb-4 text-3xl text-[#001836]">{item.title}</h3>
                      <p className="mb-8 max-w-sm text-base leading-[1.6] text-[#43474f]">
                        {item.description}
                      </p>
                    </div>
                    <a
                      href="#dat-lich"
                      className="flex items-center gap-2 text-sm font-semibold tracking-normal text-[#001836] transition-all group-hover:gap-4"
                    >
                      Xem chi tiết
                      <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
                    </a>
                  </div>
                </Reveal>
              );
            }

            if (item.wide) {
              return (
                <Reveal
                  key={item.id}
                  variant="up"
                  delay={index * 90}
                  className="md:col-span-2"
                >
                  <div className="flex h-full items-center justify-between gap-8 border border-[#c3c6d0] bg-white p-8 transition-colors hover:border-[#001836]">
                    <div className="max-w-xs">
                      <span className="material-symbols-outlined mb-4 text-3xl text-[#001836]" aria-hidden="true">
                        {item.icon}
                      </span>
                      <h3 className="le-display mb-2 text-2xl text-[#001836]">{item.title}</h3>
                      <p className="text-sm text-[#43474f]">{item.description}</p>
                    </div>
                    {item.image && (
                      <div className="h-32 w-32 shrink-0 overflow-hidden rounded-full">
                        <img
                          src={item.image}
                          alt=""
                          className="h-full w-full object-cover"
                          width={128}
                          height={128}
                          loading="lazy"
                        />
                      </div>
                    )}
                  </div>
                </Reveal>
              );
            }

            return (
              <Reveal key={item.id} variant="up" delay={index * 90}>
                <div className="h-full border border-[#c3c6d0] bg-white p-8 transition-colors hover:border-[#001836]">
                  <span className="material-symbols-outlined mb-4 text-3xl text-[#001836]" aria-hidden="true">
                    {item.icon}
                  </span>
                  <h3 className="le-display mb-2 text-2xl text-[#001836]">{item.title}</h3>
                  <p className="text-sm text-[#43474f]">{item.description}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

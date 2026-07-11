import React from 'react';
import { VISION_IMAGES, VISION_POINTS } from '../data/homeContent';
import Reveal from './Reveal';

export default function VisionSection() {
  return (
    <section className="bg-white py-20" aria-labelledby="vision-heading">
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-12 px-4 sm:px-6 md:grid-cols-12">
        <Reveal variant="left" className="md:col-span-5">
          <h2 id="vision-heading" className="le-display mb-6 text-4xl text-[#001836] sm:text-5xl">
            Tầm nhìn &amp; Sứ mệnh quốc tế
          </h2>
          <p className="mb-8 text-lg leading-[1.6] text-[#43474f]">
            Chúng tôi kiến tạo một hệ sinh thái y tế nơi công nghệ hiện đại nhất thế giới hội ngộ
            cùng sự thấu cảm sâu sắc của con người. Tại KLTN, mỗi bệnh nhân không chỉ là một ca
            bệnh, mà là một hành trình phục hồi cần được nâng niu.
          </p>
          <div className="space-y-6">
            {VISION_POINTS.map((point, i) => (
              <Reveal key={point.title} variant="up" delay={100 + i * 80}>
                <div className="flex gap-4">
                  <span className="material-symbols-outlined text-[#00a4b9]" aria-hidden="true">
                    {point.icon}
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-normal text-[#001836]">
                      {point.title}
                    </h3>
                    <p className="mt-1 text-[#43474f]">{point.description}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </Reveal>

        <div className="grid grid-cols-2 gap-4 md:col-span-7">
          <Reveal variant="up" delay={80}>
            <div className="aspect-[3/4] overflow-hidden">
              <img
                src={VISION_IMAGES[0]}
                alt="Bác sĩ nắm tay bệnh nhân — sự thấu cảm trong chăm sóc"
                className="h-full w-full object-cover"
                width={480}
                height={640}
                loading="lazy"
              />
            </div>
          </Reveal>
          <Reveal variant="up" delay={180}>
            <div className="mt-12 aspect-[3/4] overflow-hidden">
              <img
                src={VISION_IMAGES[1]}
                alt="Phòng xét nghiệm hiện đại với công nghệ chẩn đoán chính xác"
                className="h-full w-full object-cover"
                width={480}
                height={640}
                loading="lazy"
              />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

import React from 'react';
import { DOCTORS } from '../data/homeContent';
import Reveal from './Reveal';

export default function DoctorsSection() {
  return (
    <section id="doi-ngu" className="bg-white py-20" aria-labelledby="doctors-heading">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <Reveal variant="up" className="mb-12 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div>
            <span className="mb-4 block text-xs font-medium uppercase tracking-normal text-[#00a4b9]">
              Đội ngũ chuyên gia
            </span>
            <h2 id="doctors-heading" className="le-display text-4xl text-[#001836] sm:text-5xl">
              Tận tâm &amp; Kinh nghiệm
            </h2>
          </div>
          <a
            href="#dat-lich"
            className="border-b border-[#001836] pb-1 text-sm font-semibold tracking-normal text-[#001836]"
          >
            Xem tất cả bác sĩ
          </a>
        </Reveal>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {DOCTORS.map((doctor, index) => (
            <Reveal key={doctor.name} variant="up" delay={index * 100}>
              <article className="group">
                <div className="mb-6 aspect-[4/5] overflow-hidden bg-[#f7f9fb]">
                  <img
                    src={doctor.image}
                    alt={`Chân dung ${doctor.name}`}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                    width={400}
                    height={500}
                    loading="lazy"
                  />
                </div>
                <h3 className="le-display text-2xl text-[#001836]">{doctor.name}</h3>
                <p className="mt-1 text-xs font-medium uppercase tracking-normal text-[#43474f]">
                  {doctor.role}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

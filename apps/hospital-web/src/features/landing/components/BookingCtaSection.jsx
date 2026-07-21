import React from 'react';
import Reveal from './Reveal';

/** Final CTA + light booking anchors (#dat-lich) — matches mock */
export default function BookingCtaSection() {
  return (
    <section id="dat-lich" className="relative overflow-hidden bg-white py-24" aria-labelledby="cta-heading">
      <div className="pointer-events-none absolute inset-0 opacity-5" aria-hidden="true">
        <svg height="100%" width="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern height="40" id="landing-grid" patternUnits="userSpaceOnUse" width="40">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
            </pattern>
          </defs>
          <rect fill="url(#landing-grid)" height="100%" width="100%" />
        </svg>
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-4 text-center sm:px-6">
        <Reveal variant="up">
          <h2
            id="cta-heading"
            className="le-display mb-8 text-[clamp(2rem,5vw,4rem)] italic leading-[1.15] text-[#001836]"
          >
            Bắt đầu hành trình chăm sóc sức khỏe của bạn ngay hôm nay.
          </h2>
        </Reveal>
        <Reveal variant="up" delay={120}>
          <div className="flex flex-col items-center justify-center gap-6 sm:flex-row">
            <a
              href="tel:19001234"
              className="le-btn w-full bg-[#001836] px-10 py-5 text-sm font-semibold uppercase tracking-normal text-white transition-colors hover:bg-[#002d5b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#001836] sm:w-auto"
            >
              Đăng ký khám trực tuyến
            </a>
            <a
              href="#doi-ngu"
              className="le-btn w-full border border-[#001836] px-10 py-5 text-sm font-semibold uppercase tracking-normal text-[#001836] transition-colors hover:bg-[#001836] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#001836] sm:w-auto"
            >
              Tìm bác sĩ chuyên khoa
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

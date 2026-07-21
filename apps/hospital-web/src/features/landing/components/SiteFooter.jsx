import React from 'react';
import Reveal from './Reveal';

export default function SiteFooter() {
  return (
    <footer id="lien-he" className="border-t border-[#c3c6d0] bg-[#f2f4f6]" aria-labelledby="footer-heading">
      <div className="mx-auto max-w-[1280px] px-4 py-20 sm:px-6">
        <Reveal variant="up" className="mb-16 grid grid-cols-1 gap-12 md:grid-cols-12">
          <div className="md:col-span-4">
            <div className="mb-6 flex items-center gap-4">
              <div className="flex h-8 w-8 items-center justify-center bg-[#001836] text-lg font-bold text-white le-display">
                K
              </div>
              <span id="footer-heading" className="le-display text-2xl text-[#001836]">
                Bệnh viện KLTN
              </span>
            </div>
            <p className="mb-8 max-w-sm text-base leading-[1.6] text-[#43474f]">
              Hệ thống y tế quốc tế hàng đầu, cam kết mang lại trải nghiệm khám chữa bệnh chuyên
              nghiệp, tận tâm và nhân văn.
            </p>
            <div className="flex gap-4">
              {['share', 'chat', 'play_circle'].map((icon) => (
                <a
                  key={icon}
                  href="#lien-he"
                  className="flex h-10 w-10 items-center justify-center border border-[#c3c6d0] text-[#001836] transition-all hover:bg-[#001836] hover:text-white"
                  aria-label={icon}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
                </a>
              ))}
            </div>
          </div>

          <div className="md:col-span-2">
            <h3 className="mb-6 text-sm font-semibold uppercase tracking-normal text-[#001836]">
              Khám phá
            </h3>
            <ul className="space-y-4">
              {[
                { href: '#top', label: 'Về chúng tôi' },
                { href: '#chuyen-khoa', label: 'Chuyên khoa' },
                { href: '#doi-ngu', label: 'Đội ngũ bác sĩ' },
                { href: '#co-so', label: 'Cơ sở vật chất' },
              ].map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-[#43474f] transition-colors hover:text-[#001836]">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-2">
            <h3 className="mb-6 text-sm font-semibold uppercase tracking-normal text-[#001836]">
              Hỗ trợ
            </h3>
            <ul className="space-y-4">
              {['Hướng dẫn đi khám', 'Câu hỏi thường gặp', 'Chính sách bảo mật', 'Tuyển dụng'].map(
                (label) => (
                  <li key={label}>
                    <a href="#lien-he" className="text-[#43474f] transition-colors hover:text-[#001836]">
                      {label}
                    </a>
                  </li>
                ),
              )}
            </ul>
          </div>

          <div className="md:col-span-4">
            <h3 className="mb-6 text-sm font-semibold uppercase tracking-normal text-[#001836]">
              Liên hệ
            </h3>
            <div className="space-y-4 text-[#43474f]">
              <div className="flex gap-4">
                <span className="material-symbols-outlined shrink-0" aria-hidden="true">location_on</span>
                <p>123 Đường Sáng Tạo, Quận 1, TP. Hồ Chí Minh, Việt Nam</p>
              </div>
              <div className="flex gap-4">
                <span className="material-symbols-outlined shrink-0" aria-hidden="true">call</span>
                <p>
                  Hotline:{' '}
                  <a href="tel:19001234" className="hover:text-[#001836]">
                    1900 1234
                  </a>
                  <br />
                  Cấp cứu:{' '}
                  <a href="tel:02838111222" className="hover:text-[#001836]">
                    (028) 38 111 222
                  </a>
                </p>
              </div>
              <div className="flex gap-4">
                <span className="material-symbols-outlined shrink-0" aria-hidden="true">mail</span>
                <p>
                  <a href="mailto:contact@kltnhospital.vn" className="hover:text-[#001836]">
                    contact@kltnhospital.vn
                  </a>
                </p>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal variant="fade" delay={100}>
          <div className="flex flex-col items-center justify-between gap-4 border-t border-[#c3c6d0] pt-8 md:flex-row">
            <p className="text-xs font-medium text-[#43474f]">
              © {new Date().getFullYear()} Bệnh viện Đa khoa Quốc tế KLTN. All rights reserved.
            </p>
            <div className="flex gap-8">
              <a href="#lien-he" className="text-xs font-medium text-[#43474f] hover:text-[#001836]">
                Chính sách bảo mật
              </a>
              <a href="#lien-he" className="text-xs font-medium text-[#43474f] hover:text-[#001836]">
                Điều khoản sử dụng
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </footer>
  );
}

import React from 'react';
import Reveal from './Reveal';

export default function SiteFooter() {
  return (
    <footer id="lien-he" className="border-t border-slate-200 bg-slate-50 text-slate-700" aria-labelledby="footer-heading">
      <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6">
        <Reveal variant="up" className="mb-12 grid grid-cols-1 gap-10 md:grid-cols-12">
          {/* Column 1: Hospital Brand */}
          <div className="md:col-span-4">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-600 text-xl font-bold text-white shadow-md shadow-sky-600/30 le-display">
                K
              </div>
              <div>
                <span id="footer-heading" className="le-display text-2xl font-bold text-slate-900">
                  Bệnh Viện KLTN
                </span>
                <p className="text-[11px] font-bold uppercase tracking-wider text-sky-600">International Hospital</p>
              </div>
            </div>
            <p className="mb-6 max-w-sm text-xs leading-relaxed text-slate-600">
              Hệ thống y tế đa khoa quốc tế uy tín, cam kết mang đến trải nghiệm khám chữa bệnh chuyên nghiệp, tận tâm, an toàn và giàu lòng nhân ái.
            </p>
            <div className="flex gap-3">
              {['share', 'chat', 'play_circle'].map((icon) => (
                <a
                  key={icon}
                  href="#top"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:border-sky-600 hover:bg-sky-600 hover:text-white transition-all shadow-sm"
                  aria-label={icon}
                >
                  <span className="material-symbols-outlined text-lg">{icon}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div className="md:col-span-2">
            <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-900">
              Khám Phá
            </h3>
            <ul className="space-y-2.5 text-xs font-semibold">
              {[
                { href: '#top', label: 'Về chúng tôi' },
                { href: '#chuyen-khoa', label: 'Chuyên khoa' },
                { href: '#doi-ngu', label: 'Đội ngũ Bác sĩ' },
                { href: '#co-so', label: 'Cơ sở vật chất' },
              ].map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-slate-600 hover:text-sky-600 transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Working Hours */}
          <div className="md:col-span-3">
            <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-900">
              Giờ Làm Việc
            </h3>
            <ul className="space-y-2 text-xs text-slate-600">
              <li className="flex justify-between border-b border-slate-200 pb-1.5">
                <span>Thứ 2 – Thứ 7:</span>
                <strong className="text-slate-800">07:00 – 17:00</strong>
              </li>
              <li className="flex justify-between border-b border-slate-200 pb-1.5">
                <span>Chủ Nhật:</span>
                <strong className="text-slate-800">07:30 – 12:00</strong>
              </li>
              <li className="flex justify-between pt-1">
                <span>Khoa Cấp cứu:</span>
                <strong className="text-rose-600 font-bold">24/7 Trực 365 ngày</strong>
              </li>
            </ul>
          </div>

          {/* Column 4: Contact Info */}
          <div className="md:col-span-3">
            <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-900">
              Thông Tin Liên Hệ
            </h3>
            <div className="space-y-3 text-xs text-slate-600">
              <div className="flex gap-2.5">
                <span className="material-symbols-outlined shrink-0 text-sky-600 text-base">location_on</span>
                <p>123 Nguyễn Văn Cừ, Phường 4, Quận 5, TP. Hồ Chí Minh</p>
              </div>
              <div className="flex gap-2.5">
                <span className="material-symbols-outlined shrink-0 text-sky-600 text-base">call</span>
                <p>
                  Hotline:{' '}
                  <a href="tel:19001234" className="font-bold text-slate-900 hover:text-sky-600">
                    1900 1234
                  </a>
                  <br />
                  Cấp cứu:{' '}
                  <a href="tel:02838111222" className="font-bold text-rose-600">
                    (028) 38 111 222
                  </a>
                </p>
              </div>
              <div className="flex gap-2.5">
                <span className="material-symbols-outlined shrink-0 text-sky-600 text-base">mail</span>
                <p>
                  <a href="mailto:contact@kltnhospital.vn" className="hover:text-sky-600">
                    contact@kltnhospital.vn
                  </a>
                </p>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Footer Bottom Rights */}
        <Reveal variant="fade" delay={100}>
          <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 pt-6 text-xs text-slate-500 md:flex-row">
            <p>
              © {new Date().getFullYear()} Bệnh viện Đa khoa Quốc tế KLTN. Tất cả quyền được bảo lưu.
            </p>
            <div className="flex gap-6">
              <a href="#top" className="hover:text-sky-600 transition-colors">
                Chính sách bảo mật
              </a>
              <a href="#top" className="hover:text-sky-600 transition-colors">
                Điều khoản dịch vụ
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </footer>
  );
}

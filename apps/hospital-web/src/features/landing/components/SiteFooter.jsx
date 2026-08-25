import React from 'react';
import Reveal from './Reveal';
import { MapPin, PhoneCall, Mail, Clock, ShieldCheck, Heart, Sparkles, CheckCircle2 } from 'lucide-react';

export default function SiteFooter() {
  return (
    <footer className="border-t border-slate-200/80 bg-slate-50/80 text-slate-700 antialiased" aria-labelledby="footer-heading">
      <div className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
        <Reveal variant="up" className="mb-14 grid grid-cols-1 gap-10 md:grid-cols-12">
          
          {/* Column 1: Hospital Brand */}
          <div className="md:col-span-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-sky-600 text-xl font-black text-white shadow-sm">
                K
              </div>
              <div className="leading-tight">
                <span id="footer-heading" className="text-lg font-black text-slate-900 block">
                  Bệnh Viện Đa Khoa KLTN
                </span>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Y Đức Phụng Sự · Sức Khỏe Cho Mọi Nhà</p>
              </div>
            </div>
            <p className="max-w-sm text-xs leading-relaxed text-slate-600 font-medium">
              Chúng tôi luôn nỗ lực mang đến dịch vụ y tế nhẹ nhàng, nhanh chóng và tận tâm cho từng người bệnh và gia đình.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-extrabold text-emerald-700 border border-emerald-200/60 shadow-2xs">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Giấy phép hoạt động số 1234/BYT-GPHĐ
              </span>
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div className="md:col-span-2 space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
              Danh Mục Khám
            </h3>
            <ul className="space-y-2.5 text-xs font-bold text-slate-600">
              {[
                { href: '#top', label: 'Trang chủ' },
                { href: '#dich-vu', label: 'Dịch vụ khám' },
                { href: '#chuyen-khoa', label: 'Chuyên khoa' },
                { href: '#quy-trinh', label: 'Quy trình khám' },
                { href: '#doi-ngu', label: 'Đội ngũ Bác sĩ' },
                { href: '#hoi-dap', label: 'Hỏi đáp thường gặp' },
              ].map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="hover:text-sky-600 transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Working Hours */}
          <div className="md:col-span-3 space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-600" />
              <span>Thời Gian Tiếp Nhận</span>
            </h3>
            <ul className="space-y-2.5 text-xs text-slate-600 font-medium">
              <li className="flex justify-between border-b border-slate-200/80 pb-2">
                <span>Thứ 2 – Thứ 7:</span>
                <strong className="text-slate-900 font-bold font-mono">07:00 – 20:00</strong>
              </li>
              <li className="flex justify-between border-b border-slate-200/80 pb-2">
                <span>Chủ Nhật:</span>
                <strong className="text-slate-900 font-bold font-mono">07:00 – 17:00</strong>
              </li>
              <li className="flex justify-between pt-1">
                <span>Khoa Cấp cứu:</span>
                <strong className="text-rose-600 font-black font-mono">24/7 (365 ngày/năm)</strong>
              </li>
            </ul>
          </div>

          {/* Column 4: Contact Info */}
          <div className="md:col-span-3 space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
              Thông Tin Liên Hệ
            </h3>
            <div className="space-y-3 text-xs text-slate-600 font-medium">
              <div className="flex gap-3">
                <MapPin className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <p>123 Nguyễn Văn Cừ, Phường 4, Quận 5, TP. Hồ Chí Minh</p>
              </div>
              <div className="flex gap-3">
                <PhoneCall className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <p>
                  Tổng đài tư vấn: <a href="tel:19001234" className="font-extrabold text-slate-900 hover:text-sky-600 font-mono">1900 1234</a><br />
                  Cấp cứu 24/7: <a href="tel:02838111222" className="font-extrabold text-rose-600 hover:underline font-mono">(028) 38 111 222</a>
                </p>
              </div>
              <div className="flex gap-3">
                <Mail className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <p>
                  <a href="mailto:tiepdon@kltnhospital.vn" className="hover:text-sky-600 font-semibold">
                    tiepdon@kltnhospital.vn
                  </a>
                </p>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Footer Bottom Rights */}
        <Reveal variant="fade" delay={100}>
          <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-200/80 pt-8 text-xs font-semibold text-slate-500 md:flex-row">
            <p>
              © {new Date().getFullYear()} Bệnh Viện Đa Khoa KLTN. Đồng hành cùng sức khỏe gia đình bạn.
            </p>
            <div className="flex gap-6">
              <a href="#top" className="hover:text-sky-600 transition-colors">
                Chính sách bảo mật
              </a>
              <a href="#top" className="hover:text-sky-600 transition-colors">
                Quy trình tiếp nhận
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </footer>
  );
}

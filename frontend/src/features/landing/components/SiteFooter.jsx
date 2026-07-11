import React from 'react';
import { MapPin, Phone } from 'lucide-react';
import { CAMPUSES, NAV_LINKS } from '../data/homeContent';

export default function SiteFooter() {
  return (
    <footer id="lien-he" className="border-t border-slate-200 bg-slate-950 text-slate-100" aria-labelledby="footer-heading">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <h2 id="footer-heading" className="text-xl font-bold text-white">
              BVĐK Quốc tế KLTN
            </h2>
            <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-300">
              Bệnh viện Đa khoa Quốc tế — chăm sóc toàn diện, quy trình minh bạch, ưu tiên an toàn người bệnh.
            </p>
            <p className="mt-4 text-sm font-semibold text-slate-400">
              Giấy phép hoạt động khám bệnh, chữa bệnh số: 1234/GPHĐ-BYT (minh họa)
            </p>
          </div>

          <div className="lg:col-span-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Liên kết</p>
            <ul className="mt-4 space-y-2">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="inline-flex min-h-11 items-center text-sm font-bold text-slate-200 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4 lg:col-span-5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Cơ sở & bản đồ</p>
            {CAMPUSES.map((campus) => (
              <article key={campus.name} className="rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
                <h3 className="text-base font-bold text-white">{campus.name}</h3>
                <p className="mt-2 flex gap-2 text-sm font-semibold leading-relaxed text-slate-300">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-300" aria-hidden />
                  {campus.address}
                </p>
                <p className="mt-2 flex gap-2 text-sm font-semibold text-slate-300">
                  <Phone className="h-4 w-4 shrink-0 text-blue-300" aria-hidden />
                  <a href={`tel:${campus.phone.replace(/\s/g, '')}`} className="hover:text-white underline-offset-2 hover:underline">
                    {campus.phone}
                  </a>
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-400">{campus.hours}</p>
                <div
                  className="mt-3 flex h-28 items-center justify-center rounded-xl bg-slate-800 text-xs font-bold uppercase tracking-wider text-slate-400 ring-1 ring-slate-700"
                  role="img"
                  aria-label={`Bản đồ minh họa vị trí ${campus.name}`}
                >
                  Bản đồ thu nhỏ · {campus.name}
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-slate-800 pt-6 text-xs font-semibold text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Bệnh viện Đa khoa Quốc tế KLTN. Bảo lưu mọi quyền.</p>
          <p>Thông tin trên website mang tính giới thiệu. Chỉ định điều trị do bác sĩ quyết định.</p>
        </div>
      </div>
    </footer>
  );
}

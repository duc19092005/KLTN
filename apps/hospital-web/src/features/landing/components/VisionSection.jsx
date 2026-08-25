import React from 'react';
import Reveal from './Reveal';
import { QUICK_SERVICES } from '../data/homeContent';
import {
  HeartHandshake,
  Activity,
  Baby,
  Stethoscope,
  Clock,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

const SERVICE_ICONS = {
  'kham-tong-quat': Stethoscope,
  'kham-chuyen-khoa': HeartHandshake,
  'kham-san-nhi': Baby,
  'xet-nghiem-tai-vien': Activity,
  'kham-ngoai-gio': Clock,
  'tam-soat-chuyen-sau': ShieldCheck,
};

export default function VisionSection() {
  return (
    <section id="dich-vu" className="bg-slate-50/50 py-20 border-t border-slate-200/60 antialiased" aria-labelledby="services-heading">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-8">
        
        <Reveal variant="up" className="mb-14 text-center max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider text-sky-700 mb-3 border border-sky-200/80 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-sky-600" />
            <span>Dịch Vụ Y Tế Đời Thường & Thiết Thực</span>
          </span>
          <h2 id="services-heading" className="text-3xl font-black text-slate-900 sm:text-4xl tracking-tight leading-tight">
            Đáp Ứng Mọi Nhu Cầu Chăm Sóc Sức Khỏe Gia Đình
          </h2>
          <p className="mt-3 text-sm text-slate-600 font-medium leading-relaxed">
            Từ khám sức khỏe định kỳ, chăm sóc mẹ và bé đến xét nghiệm nhanh trong ngày — Tất cả đều được thực hiện chu đáo với chi phí minh bạch và hỗ trợ BHYT đầy đủ.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {QUICK_SERVICES.map((srv, index) => {
            const Icon = SERVICE_ICONS[srv.id] || Stethoscope;
            return (
              <Reveal key={srv.id} variant="up" delay={index * 80}>
                <div className="group relative flex h-full flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-7 shadow-xs hover:border-sky-300 hover:shadow-xl transition-all duration-300">
                  <div>
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 border border-sky-100 shadow-2xs group-hover:bg-sky-600 group-hover:text-white transition-all duration-300">
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-extrabold text-slate-600 group-hover:bg-sky-50 group-hover:text-sky-700 transition-colors">
                        {srv.tag}
                      </span>
                    </div>

                    <h3 className="text-lg font-extrabold text-slate-900 mb-2 group-hover:text-sky-600 transition-colors">
                      {srv.title}
                    </h3>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      {srv.desc}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100">
                    <a
                      href="#lien-he"
                      className="inline-flex items-center gap-1.5 text-xs font-extrabold text-sky-600 hover:text-sky-700 transition-colors group-hover:translate-x-1 duration-200"
                    >
                      <span>Tư vấn & Đăng ký gói khám</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

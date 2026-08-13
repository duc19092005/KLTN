import React from 'react';
import Reveal from './Reveal';
import { Stethoscope, Heart, Baby, Bone, Activity, ArrowRight, ChevronRight, Sparkles, Brain } from 'lucide-react';

const SPECIALITIES = [
  {
    id: 'tim-mach',
    title: 'Khoa Tim Mạch',
    description: 'Chẩn đoán và điều trị chuyên sâu các bệnh lý tim mạch, mạch máu với kỹ thuật thăm khám tân tiến và chu đáo.',
    icon: Heart,
    featured: true,
    tag: 'Chuyên khoa trọng điểm',
  },
  {
    id: 'san-nhi',
    title: 'Khoa Sản Phụ & Nhi Khoa',
    description: 'Chăm sóc toàn diện cho mẹ bầu trong suốt thai kỳ an toàn và đồng hành cùng sự phát triển khỏe mạnh của bé.',
    icon: Baby,
  },
  {
    id: 'co-xuong-khop',
    title: 'Khoa Cơ Xương Khớp',
    description: 'Điều trị bệnh lý xương khớp, chấn thương thể thao và phẫu thuật phục hồi chức năng vận động linh hoạt.',
    icon: Bone,
  },
  {
    id: 'ung-buou',
    title: 'Khoa Ung Bướu & Tầm Soát',
    description: 'Tầm soát ung thư sớm, phác đồ điều trị đa mô thức cá thể hóa bảo vệ sức khỏe cho người bệnh.',
    icon: Activity,
  },
  {
    id: 'than-kinh',
    title: 'Khoa Thần Kinh',
    description: 'Điều trị đột quỵ khẩn cấp, đau đầu mãn tính và các rối loạn thần kinh chuyên sâu.',
    icon: Brain,
  },
  {
    id: 'xet-nghiem-mri',
    title: 'Chẩn Đoán Hình Ảnh & Xét Nghiệm',
    description: 'Trang bị MRI 3.0 Tesla, CT-Scanner đa lát cắt và hệ thống xét nghiệm tự động cho kết quả chính xác.',
    icon: Stethoscope,
  },
];

export default function SpecialitiesSection() {
  return (
    <section id="chuyen-khoa" className="bg-slate-50/60 py-20 border-t border-slate-100 antialiased" aria-labelledby="specialities-heading">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-8">
        <Reveal variant="up" className="mb-14 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-sky-700 mb-3 border border-sky-100">
            <Sparkles className="w-3.5 h-3.5 text-sky-600" />
            <span>Danh Mục Chuyên Khoa Thăm Khám</span>
          </span>
          <h2 id="specialities-heading" className="text-3xl font-black text-slate-900 sm:text-4xl tracking-tight">
            Các Chuyên Khoa Trọng Điểm
          </h2>
          <p className="mt-3 text-sm text-slate-600 max-w-2xl mx-auto font-medium leading-relaxed">
            Hệ thống phòng khám chuyên khoa được đầu tư đồng bộ trang thiết bị y khoa hiện đại, đáp ứng mọi nhu cầu khám chữa bệnh.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-4">
          {SPECIALITIES.map((item, index) => {
            const IconComponent = item.icon || Stethoscope;
            if (item.featured) {
              return (
                <Reveal
                  key={item.id}
                  variant="up"
                  delay={index * 80}
                  className="md:col-span-2"
                >
                  <div className="group flex h-full flex-col justify-between rounded-3xl border border-sky-200 bg-gradient-to-br from-white via-sky-50/30 to-cyan-50/30 p-8 shadow-xs hover:border-sky-300 hover:shadow-md transition-all duration-300">
                    <div>
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-xs group-hover:scale-105 transition-transform">
                          <IconComponent className="w-6.5 h-6.5" />
                        </div>
                        <span className="rounded-full bg-sky-100 px-3.5 py-1 text-[11px] font-bold text-sky-800 border border-sky-200">
                          {item.tag}
                        </span>
                      </div>
                      <h3 className="mb-3 text-2xl font-bold text-slate-900 group-hover:text-sky-600 transition-colors">{item.title}</h3>
                      <p className="mb-6 max-w-lg text-sm leading-relaxed text-slate-600 font-medium">
                        {item.description}
                      </p>
                    </div>
                    <a
                      href="#lien-he"
                      className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-700 hover:text-sky-800 transition-all"
                    >
                      <span>Đăng ký hẹn khám ngay</span>
                      <ArrowRight className="w-4 h-4 text-sky-600" />
                    </a>
                  </div>
                </Reveal>
              );
            }

            return (
              <Reveal key={item.id} variant="up" delay={index * 80}>
                <div className="group flex h-full flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-7 shadow-xs hover:border-sky-300 hover:shadow-md transition-all duration-300">
                  <div>
                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white transition-all shadow-2xs">
                      <IconComponent className="w-6 h-6" />
                    </div>
                    <h3 className="mb-2 text-base font-bold text-slate-900 group-hover:text-sky-600 transition-colors">{item.title}</h3>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">{item.description}</p>
                  </div>
                  <a
                    href="#lien-he"
                    className="mt-6 inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 hover:text-sky-700 transition"
                  >
                    <span>Đặt lịch hẹn</span>
                    <ChevronRight className="w-4 h-4" />
                  </a>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

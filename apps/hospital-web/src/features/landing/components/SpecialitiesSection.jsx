import React from 'react';
import Reveal from './Reveal';
import { Stethoscope, Heart, Baby, Bone, Activity, ArrowRight, ChevronRight, Sparkles, Eye, Brain, Pill } from 'lucide-react';

const SPECIALITIES = [
  {
    id: 'tim-mach',
    title: 'Khoa Tim Mạch',
    description: 'Chẩn đoán và điều trị chuyên sâu các bệnh lý tim mạch, mạch máu với kỹ thuật can thiệp tim mạch tân tiến.',
    icon: Heart,
    featured: true,
    tag: 'Trung tâm mũi nhọn',
  },
  {
    id: 'san-nhi',
    title: 'Khoa Sản Phụ & Nhi Khoa',
    description: 'Chăm sóc toàn diện cho mẹ bầu trong thai kỳ an toàn và đồng hành cùng sự phát triển khỏe mạnh của bé.',
    icon: Baby,
  },
  {
    id: 'co-xuong-khop',
    title: 'Khoa Cơ Xương Khớp',
    description: 'Phẫu thuật nội soi khớp, tái tạo dây chằng và điều trị phục hồi chức năng vận động linh hoạt.',
    icon: Bone,
  },
  {
    id: 'ung-buou',
    title: 'Khoa Ung Bướu',
    description: 'Tầm soát ung thư sớm, phác đồ điều trị đa mô thức cá thể hóa chuẩn quốc tế.',
    icon: Activity,
  },
  {
    id: 'than-kinh',
    title: 'Khoa Thần Kinh',
    description: 'Điều trị đau đầu mãn tính, tai biến đột quỵ và các rối loạn thần kinh chuyên sâu.',
    icon: Brain,
  },
  {
    id: 'xet-nghiem-mri',
    title: 'Chẩn Đoán Hình Ảnh & Xét Nghiệm',
    description: 'Trang bị MRI 3.0 Tesla, CT-Scanner đa lát cắt và hệ thống xét nghiệm tự động hóa cho kết quả chính xác.',
    icon: Stethoscope,
  },
];

export default function SpecialitiesSection() {
  return (
    <section id="chuyen-khoa" className="bg-slate-50/60 py-20 border-t border-slate-100 antialiased" aria-labelledby="specialities-heading">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <Reveal variant="up" className="mb-14 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-sky-700 mb-3 border border-sky-100 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-sky-600" />
            <span>Chuyên Khoa Y Tế Đạt Chuẩn</span>
          </span>
          <h2 id="specialities-heading" className="text-3xl font-extrabold text-slate-900 sm:text-4xl tracking-tight">
            Các Chuyên Khoa Trọng Điểm
          </h2>
          <p className="mt-3 text-sm text-slate-600 max-w-xl mx-auto font-medium leading-relaxed">
            Hệ thống phòng khám chuyên khoa được đầu tư đồng bộ trang thiết bị y tế hiện đại, sẵn sàng đáp ứng mọi nhu cầu khám chữa bệnh.
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
                  <div className="group flex h-full flex-col justify-between rounded-3xl border border-sky-200/80 bg-gradient-to-br from-white via-sky-50/40 to-cyan-50/40 p-8 shadow-sm hover:border-sky-400 hover:shadow-xl transition-all duration-300">
                    <div>
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-md shadow-sky-600/30 group-hover:scale-110 transition-transform">
                          <IconComponent className="w-7 h-7" />
                        </div>
                        <span className="rounded-full bg-sky-100 px-3.5 py-1 text-[11px] font-bold text-sky-700 border border-sky-200">
                          {item.tag}
                        </span>
                      </div>
                      <h3 className="mb-3 text-2xl font-bold text-slate-900 group-hover:text-sky-600 transition-colors">{item.title}</h3>
                      <p className="mb-6 max-w-md text-sm leading-relaxed text-slate-600 font-medium">
                        {item.description}
                      </p>
                    </div>
                    <a
                      href="#lien-he"
                      className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-700 hover:text-sky-800 transition-all group-hover:gap-3"
                    >
                      <span>Đăng ký khám khoa Tim mạch</span>
                      <ArrowRight className="w-4 h-4" />
                    </a>
                  </div>
                </Reveal>
              );
            }

            return (
              <Reveal key={item.id} variant="up" delay={index * 80}>
                <div className="group flex h-full flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm hover:border-sky-300 hover:shadow-md transition-all duration-300">
                  <div>
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white transition-all shadow-xs">
                      <IconComponent className="w-6 h-6" />
                    </div>
                    <h3 className="mb-2 text-base font-bold text-slate-900 group-hover:text-sky-600 transition-colors">{item.title}</h3>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">{item.description}</p>
                  </div>
                  <a
                    href="#lien-he"
                    className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 hover:text-sky-700 transition"
                  >
                    <span>Đặt lịch khám</span>
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

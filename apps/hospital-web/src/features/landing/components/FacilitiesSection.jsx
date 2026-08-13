import React from 'react';
import { FACILITY_IMAGE } from '../data/homeContent';
import Reveal from './Reveal';
import { Cpu, ShieldCheck, Activity, Award, Sparkles, CheckCircle2 } from 'lucide-react';

const ADVANCED_FACILITIES = [
  {
    icon: Activity,
    title: 'Hệ thống MRI 3.0 Tesla Silent Edition',
    desc: 'Chụp cộng hưởng từ hình ảnh cực nét, vận hành êm ái giảm tiếng ồn, phát hiện sớm các tổn thương nhỏ nhất.',
    badge: 'Công nghệ êm ái',
  },
  {
    icon: Cpu,
    title: 'Phẫu thuật Nội soi & Robot Da Vinci',
    desc: 'Hỗ trợ phẫu thuật chính xác tuyệt đối, vết mổ tối thiểu, ít đau và rút ngắn thời gian hồi phục cho người bệnh.',
    badge: 'Xâm lấn tối thiểu',
  },
  {
    icon: ShieldCheck,
    title: 'Xét nghiệm Tự động Hóa ISO 15189',
    desc: 'Hệ thống tự động trả kết quả nhanh chóng, minh bạch và chính xác 99.8% giúp bác sĩ đưa ra phác đồ kịp thời.',
    badge: 'Độ chính xác 99.8%',
  },
  {
    icon: Award,
    title: 'AI Hỗ trợ Tầm soát & Bệnh án Điện tử',
    desc: 'Công nghệ AI sàng lọc chẩn đoán hình ảnh và lưu trữ hồ sơ bệnh án an toàn, bảo mật dữ liệu tuyệt đối.',
    badge: 'Bảo mật Y tế',
  },
];

export default function FacilitiesSection() {
  return (
    <section id="co-so" className="bg-white py-20 border-t border-slate-100 antialiased" aria-labelledby="facilities-heading">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          {/* Left Column Image */}
          <div className="lg:col-span-6">
            <Reveal variant="left">
              <div className="relative">
                <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-3 shadow-xl">
                  <div className="aspect-[4/3] overflow-hidden rounded-2xl">
                    <img
                      src={FACILITY_IMAGE}
                      alt="Phòng chẩn đoán hình ảnh MRI hiện đại"
                      className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                      width={640}
                      height={480}
                      loading="lazy"
                    />
                  </div>
                </div>
                <div className="absolute -bottom-6 -right-2 hidden rounded-2xl border border-sky-100 bg-white/95 backdrop-blur-md p-5 text-slate-900 shadow-xl md:block">
                  <span className="block text-3xl font-black text-sky-600">99.8%</span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Độ chính xác chẩn đoán
                  </span>
                </div>
              </div>
            </Reveal>
          </div>

          {/* Right Column Content */}
          <div className="lg:col-span-6 space-y-6">
            <Reveal variant="right" delay={120}>
              <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-sky-700 border border-sky-100 shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                <span>Trang Thiết Bị Y Khoa Hiện Đại</span>
              </span>
              <h2 id="facilities-heading" className="text-3xl font-extrabold text-slate-900 sm:text-4xl tracking-tight leading-tight">
                Cơ Sở Vật Chất & Công Nghệ Y Tế Hàng Đầu
              </h2>
              <p className="text-sm leading-relaxed text-slate-600 font-medium">
                Chúng tôi liên tục cập nhật các thế hệ trang thiết bị chẩn đoán và điều trị tân tiến từ các quốc gia hàng đầu, giúp tối ưu hóa thời gian khám và mang lại sự an tâm tuyệt đối cho người bệnh.
              </p>
            </Reveal>

            <div className="space-y-3.5 pt-2">
              {ADVANCED_FACILITIES.map((item, i) => {
                const IconComponent = item.icon;
                return (
                  <Reveal key={item.title} variant="up" delay={140 + i * 80}>
                    <div className="flex gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 transition-all hover:bg-white hover:border-sky-300 hover:shadow-md">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white shadow-md shadow-sky-600/20">
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm sm:text-base font-bold text-slate-900">{item.title}</h3>
                          <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-[10px] font-bold text-sky-700 border border-sky-100">
                            <CheckCircle2 className="w-3 h-3 text-sky-600" />
                            {item.badge}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500 font-medium leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

import React from 'react';
import Reveal from './Reveal';
import { CalendarCheck, UserCheck, Stethoscope, FileHeart, ArrowRight, Sparkles } from 'lucide-react';

const STEPS = [
  {
    step: '01',
    icon: CalendarCheck,
    title: 'Đặt Lịch Trực Tuyến',
    desc: 'Chủ động chọn chuyên khoa, bác sĩ và khung giờ khám phù hợp chỉ trong 1 phút qua Website hoặc Hotline 1900 1234.',
    color: 'bg-sky-50 text-sky-600 border-sky-100',
  },
  {
    step: '02',
    icon: UserCheck,
    title: 'Tiếp Đón Ưu Tiên',
    desc: 'Được chào đón chu đáo tại Quầy Tiếp đón, hoàn tất thủ tục đăng ký khám nhanh chóng mà không phải chờ đợi lâu.',
    color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  },
  {
    step: '03',
    icon: Stethoscope,
    title: 'Thăm Khám Chuyên Sâu',
    desc: 'Bác sĩ chuyên khoa đầu ngành thăm khám kỹ lưỡng, chỉ định xét nghiệm và chẩn đoán hình ảnh trên thiết bị hiện đại.',
    color: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  },
  {
    step: '04',
    icon: FileHeart,
    title: 'Nhận Kết Quả & Tư Vấn',
    desc: 'Kết quả được trả minh bạch, bác sĩ tư vấn phác đồ điều trị tận tâm và hướng dẫn chăm sóc sức khỏe lâu dài.',
    color: 'bg-amber-50 text-amber-600 border-amber-100',
  },
];

export default function PatientJourneySection() {
  return (
    <section id="quy-trinh" className="bg-slate-50/70 py-20 border-t border-slate-100 antialiased" aria-labelledby="journey-heading">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <Reveal variant="up" className="mb-14 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-sky-700 mb-3 border border-sky-100 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-sky-600" />
            <span>Trải Nghiệm Khám Chữa Bệnh Tận Tâm</span>
          </span>
          <h2 id="journey-heading" className="text-3xl font-extrabold text-slate-900 sm:text-4xl tracking-tight">
            Quy Trình Thăm Khám Chuẩn Quốc Tế
          </h2>
          <p className="mt-3 text-sm text-slate-600 max-w-2xl mx-auto font-medium leading-relaxed">
            Chúng tôi tinh gọn mọi thủ tục hành chính, mang đến cho người bệnh và gia đình trải nghiệm y tế nhẹ nhàng, chu đáo và an tâm nhất.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((item, index) => {
            const IconComponent = item.icon;
            return (
              <Reveal key={item.step} variant="up" delay={index * 90}>
                <div className="group relative h-full flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-7 shadow-sm hover:border-sky-300 hover:shadow-xl transition-all duration-300">
                  <div>
                    {/* Top Step Number Badge */}
                    <div className="flex items-center justify-between mb-6">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${item.color} shadow-xs group-hover:scale-110 transition-transform duration-300`}>
                        <IconComponent className="w-6 h-6" />
                      </div>
                      <span className="text-2xl font-black text-slate-200 font-mono group-hover:text-sky-500 transition-colors">
                        {item.step}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-sky-600 transition-colors">
                      {item.title}
                    </h3>

                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      {item.desc}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-1.5 text-xs font-bold text-sky-600 group-hover:text-sky-700">
                    <span>Xem thêm</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
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

import React from 'react';
import Reveal from './Reveal';
import { HeartHandshake, FileCheck, Building2, Sparkles } from 'lucide-react';

const VISION_IMG_1 = 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=800&q=80';
const VISION_IMG_2 = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=800&q=80';

export default function VisionSection() {
  const humanPillars = [
    {
      icon: HeartHandshake,
      title: 'Y Bác sĩ Tận tụy & Lắng nghe',
      desc: 'Mỗi bệnh nhân luôn được chào đón với sự ân cần đầm ấm. Lộ trình thăm khám được giải thích chi tiết, chu đáo.'
    },
    {
      icon: FileCheck,
      title: 'Minh bạch Hồ sơ & Kết quả Khám',
      desc: 'Người bệnh và gia đình chủ động nắm rõ thông tin sức khỏe, kết quả xét nghiệm được lưu trữ an toàn, rõ ràng.'
    },
    {
      icon: Building2,
      title: 'Môi trường Khám chữa bệnh Đạt chuẩn',
      desc: 'Không gian phòng khám sạch đẹp, yên tĩnh, tạo cảm giác thư thái và an tâm như ở nhà.'
    }
  ];

  return (
    <section id="ve-chung-toi" className="bg-white py-20 border-t border-slate-100 antialiased" aria-labelledby="vision-heading">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          {/* Left Column */}
          <div className="lg:col-span-6">
            <Reveal variant="left">
              <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-sky-700 mb-3 border border-sky-100">
                <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                <span>Sứ mệnh Chăm sóc sức khỏe</span>
              </span>
              <h2 id="vision-heading" className="text-3xl font-extrabold text-slate-900 sm:text-4xl leading-tight tracking-tight">
                Đặt sự hài lòng và sức khỏe của bệnh nhân lên hàng đầu.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600 font-medium">
                Tại Bệnh viện KLTN, chúng tôi hiểu rằng niềm tin của người bệnh được xây dựng từ những quan tâm chân thành nhất. Mọi quy trình khám đều hướng tới sự thoải mái và nhanh chóng cho bạn.
              </p>
            </Reveal>

            <div className="mt-8 space-y-3.5">
              {humanPillars.map((item, index) => {
                const Icon = item.icon;
                return (
                  <Reveal key={item.title} variant="up" delay={80 + index * 80}>
                    <div className="flex gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 transition-all hover:bg-white hover:border-sky-300 hover:shadow-md">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white shadow-md shadow-sky-600/20">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm sm:text-base font-bold text-slate-900">{item.title}</h3>
                        <p className="mt-1 text-xs text-slate-500 font-medium leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>

          {/* Right Column Visual Images */}
          <div className="lg:col-span-6">
            <div className="grid grid-cols-2 gap-4">
              <Reveal variant="up" delay={80}>
                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-2.5 shadow-lg">
                  <div className="aspect-[3/4] overflow-hidden rounded-2xl">
                    <img
                      src={VISION_IMG_1}
                      alt="Bác sĩ ân cần lắng nghe bệnh nhân"
                      className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                      width={480}
                      height={640}
                      loading="lazy"
                    />
                  </div>
                </div>
              </Reveal>

              <Reveal variant="up" delay={160}>
                <div className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white p-2.5 shadow-lg">
                  <div className="aspect-[3/4] overflow-hidden rounded-2xl">
                    <img
                      src={VISION_IMG_2}
                      alt="Phòng khám sạch đẹp và trang thiết bị hiện đại"
                      className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                      width={480}
                      height={640}
                      loading="lazy"
                    />
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

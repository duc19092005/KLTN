import React from 'react';
import { PhoneCall } from 'lucide-react';
import { Button } from '../../../shared/components/ui';

export default function HeroSection() {
  return (
    <section id="top" className="border-b border-slate-200 bg-gradient-to-b from-white via-slate-50 to-blue-50/40" aria-labelledby="hero-heading">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-2 lg:items-center lg:gap-12 lg:px-8 lg:py-20">
        <div>
          <p className="inline-flex rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-blue-900 ring-1 ring-blue-100">
            Bệnh viện Đa khoa Quốc tế
          </p>
          <h1 id="hero-heading" className="mt-5 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl lg:text-5xl lg:leading-[1.1]">
            Chất lượng khám chữa bệnh
            <span className="block text-blue-800">bạn có thể tin tưởng mỗi ngày</span>
          </h1>
          <p className="mt-5 max-w-xl text-base font-semibold leading-relaxed text-slate-700 sm:text-lg">
            Đội ngũ y bác sĩ giàu kinh nghiệm, quy trình rõ ràng từ tiếp nhận đến kết luận —
            để bạn và gia đình luôn biết mình đang được chăm sóc như thế nào.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button
              as="a"
              href="#dat-lich"
              size="lg"
              className="min-h-12 justify-center bg-blue-800 px-6 text-base font-bold hover:bg-blue-900 focus-visible:ring-blue-700 sm:min-w-[200px]"
            >
              Đặt lịch khám
            </Button>
            <Button
              as="a"
              href="tel:19001155"
              variant="danger"
              size="lg"
              className="min-h-12 justify-center gap-2 px-6 text-base font-bold sm:min-w-[220px]"
              aria-label="Gọi hotline cấp cứu 24 trên 7, số 1900 1155"
            >
              <PhoneCall className="h-5 w-5" aria-hidden />
              Hotline Cấp cứu 24/7
            </Button>
          </div>

          <dl className="mt-10 grid grid-cols-3 gap-3 max-w-lg">
            {[
              { label: 'Giờ khám', value: '7:00–17:00' },
              { label: 'Cấp cứu', value: '24/7' },
              { label: 'Cơ sở', value: '2 điểm' },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
                <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{item.label}</dt>
                <dd className="mt-1 text-sm font-bold text-slate-950 sm:text-base">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative">
          <div className="overflow-hidden rounded-3xl bg-slate-900 shadow-xl shadow-slate-900/10 ring-1 ring-slate-200">
            <img
              src="/brand/hospital-hero.jpg"
              alt="Không gian bệnh viện sạch sẽ, yên tĩnh, tạo cảm giác tin cậy"
              className="aspect-[4/3] w-full object-cover"
              width={960}
              height={720}
              loading="eager"
              decoding="async"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent p-5 sm:p-6">
              <p className="text-sm font-bold text-white sm:text-base">
                Không gian khám sạch sẽ · Nhân viên hỗ trợ tận tình
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-200 sm:text-sm">
                Ưu tiên sự an toàn và trải nghiệm của người bệnh
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

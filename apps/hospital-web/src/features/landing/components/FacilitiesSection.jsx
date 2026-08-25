import React from 'react';
import Reveal from './Reveal';
import { PATIENT_REVIEWS } from '../data/homeContent';
import {
  Sparkles,
  Coffee,
  HeartHandshake,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  Star,
  Quote,
} from 'lucide-react';

const AMENITIES = [
  {
    icon: Coffee,
    title: 'Sảnh Chờ Tiện Nghi & Máy Lạnh Mát Mẻ',
    desc: 'Không gian chờ rộng rãi, thoáng đãng, phục vụ trà nước miễn phí và ghế ngồi êm ái cho người nhà và bệnh nhân.',
    tag: 'Thoải mái',
  },
  {
    icon: HeartHandshake,
    title: 'Ưu Tiên Người Cao Tuổi & Trẻ Nhỏ',
    desc: 'Có sẵn xe lăn tại cửa đón tiếp, bàn hướng dẫn riêng và điều dưỡng hỗ trợ di chuyển chu đáo suốt buổi khám.',
    tag: 'Tận tình',
  },
  {
    icon: Smartphone,
    title: 'Kết Quả Khám Lưu Trực Tiếp Trên Điện Thoại',
    desc: 'Dễ dàng xem lại đơn thuốc, hình ảnh siêu âm và kết quả xét nghiệm mọi lúc mọi nơi mà không sợ thất lạc giấy tờ.',
    tag: 'Tiện lợi',
  },
  {
    icon: ShieldCheck,
    title: 'Chi Phí Minh Bạch & Hỗ Trợ BHYT',
    desc: 'Bảng giá dịch vụ công khai rõ ràng, thanh toán BHYT trực tiếp giúp tối ưu chi phí cho gia đình.',
    tag: 'Minh bạch',
  },
];

export default function FacilitiesSection() {
  return (
    <section id="trai-nghiem" className="bg-white py-20 border-t border-slate-200/60 antialiased" aria-labelledby="facilities-heading">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-8">
        
        {/* Section Header */}
        <Reveal variant="up" className="mb-14 text-center max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider text-sky-700 mb-3 border border-sky-200/80 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-sky-600" />
            <span>Trải Nghiệm Khám Bệnh Thoải Mái</span>
          </span>
          <h2 id="facilities-heading" className="text-3xl font-black text-slate-900 sm:text-4xl tracking-tight leading-tight">
            Không Gian Khám Sạch Sẽ, Chu Đáo & Thân Thiện
          </h2>
          <p className="mt-3 text-sm text-slate-600 font-medium leading-relaxed">
            Chúng tôi chú trọng từng trải nghiệm nhỏ nhất để mỗi lần đến khám là một lần an tâm, nhẹ nhàng như đang ở nhà.
          </p>
        </Reveal>

        {/* 4 Amenities Cards Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 mb-16">
          {AMENITIES.map((item, index) => {
            const Icon = item.icon;
            return (
              <Reveal key={item.title} variant="up" delay={index * 80}>
                <div className="group flex h-full flex-col justify-between rounded-3xl border border-slate-200/80 bg-slate-50/50 p-6 shadow-xs hover:border-sky-300 hover:bg-white hover:shadow-xl transition-all duration-300">
                  <div>
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 border border-sky-100 shadow-2xs group-hover:bg-sky-600 group-hover:text-white transition-all">
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className="rounded-full bg-sky-100/70 px-2.5 py-0.5 text-[10px] font-extrabold text-sky-800 border border-sky-200/60">
                        {item.tag}
                      </span>
                    </div>

                    <h3 className="text-base font-extrabold text-slate-900 mb-2 group-hover:text-sky-600 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      {item.desc}
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100/80 flex items-center gap-1.5 text-[11px] font-bold text-emerald-600">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Tiêu chuẩn bệnh viện quốc tế</span>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>

        {/* Real Patient Reviews Strip */}
        <div className="rounded-3xl border border-slate-200/80 bg-slate-50/70 p-8 sm:p-10">
          <Reveal variant="up" className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-extrabold text-slate-900">
                Chia Sẻ Thực Tế Từ Người Bệnh & Gia Đình
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Lắng nghe trải nghiệm thăm khám chân thực của những bệnh nhân đã tin chọn Bệnh viện KLTN
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2 border border-slate-200 shadow-2xs">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <span className="text-xs font-black text-slate-900 font-mono">4.9 / 5.0</span>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {PATIENT_REVIEWS.map((rev, i) => (
              <Reveal key={rev.id} variant="up" delay={i * 100}>
                <div className="flex h-full flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs hover:border-sky-300 hover:shadow-md transition-all">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1 text-amber-400">
                        {[...Array(rev.rating)].map((_, idx) => (
                          <Star key={idx} className="w-3.5 h-3.5 fill-amber-400" />
                        ))}
                      </div>
                      <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100">
                        {rev.service}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 font-medium leading-relaxed italic mb-4">
                      "{rev.content}"
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100">
                    <strong className="block text-xs font-extrabold text-slate-900">{rev.author}</strong>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}

import React from 'react';
import { NEWS } from '../data/homeContent';
import Reveal from './Reveal';
import { Sparkles, ArrowRight, BookOpen, Clock } from 'lucide-react';

export default function NewsSection() {
  return (
    <section id="tin-tuc" className="bg-white py-24 border-t border-slate-200/60 antialiased" aria-labelledby="news-heading">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-8">
        <Reveal variant="up" className="mb-16 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-sky-100/80 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-sky-800 mb-3 border border-sky-200">
              <Sparkles className="w-3.5 h-3.5 text-sky-600" />
              <span>Y Học Thường Thức & Khuyên Dùng Từ Bác Sĩ</span>
            </span>
            <h2 id="news-heading" className="text-3xl font-black text-slate-900 sm:text-4xl tracking-tight">
              Tin Tức Y Tế & Góc Sức Khỏe
            </h2>
            <p className="mt-2 text-sm text-slate-600 max-w-xl font-medium leading-relaxed">
              Cập nhật những kiến thức y học bổ ích, kinh nghiệm chăm sóc sức khỏe và hoạt động mới nhất từ Bệnh viện Đa khoa KLTN.
            </p>
          </div>
          <a
            href="#tin-tuc"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-bold text-slate-700 hover:border-sky-600 hover:text-sky-600 transition-all shadow-xs"
          >
            <BookOpen className="w-4 h-4 text-sky-600" />
            <span>Tất cả bài viết</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </Reveal>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {NEWS.map((article, index) => (
            <Reveal key={article.id} variant="up" delay={index * 110}>
              <article className="group flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm hover:border-sky-300 hover:shadow-xl transition-all duration-300">
                <div>
                  <div className="h-56 overflow-hidden rounded-2xl bg-slate-100 mb-5 relative">
                    <img
                      src={article.image}
                      alt={article.title}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      width={640}
                      height={360}
                      loading="lazy"
                    />
                    <div className="absolute top-3 left-3 rounded-full bg-white/90 backdrop-blur-xs px-3.5 py-1 text-[10px] font-black uppercase tracking-wider text-sky-800 border border-sky-200">
                      {article.category}
                    </div>
                  </div>
                  <div className="px-2">
                    <h3 className="text-lg font-black text-slate-900 leading-snug group-hover:text-sky-600 transition-colors mb-2">
                      {article.title}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed line-clamp-3 mb-4">
                      {article.excerpt}
                    </p>
                  </div>
                </div>
                <div className="pt-4 px-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-sky-600">
                  <span className="flex items-center gap-1.5 text-slate-400 font-medium text-[11px]">
                    <Clock className="w-3.5 h-3.5" /> 5 phút đọc
                  </span>
                  <span className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    Đọc chi tiết <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

import React from 'react';
import { NEWS } from '../data/homeContent';
import Reveal from './Reveal';

export default function NewsSection() {
  return (
    <section id="tin-tuc" className="bg-[#f7f9fb] py-20" aria-labelledby="news-heading">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <Reveal variant="up" className="mb-12 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <h2 id="news-heading" className="le-display text-4xl text-[#001836] sm:text-5xl">
            Tin tức &amp; Kiến thức
          </h2>
          <a
            href="#tin-tuc"
            className="text-sm font-semibold tracking-normal text-[#001836] hover:underline"
          >
            Xem thêm bài viết
          </a>
        </Reveal>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {NEWS.map((article, index) => (
            <Reveal key={article.id} variant="up" delay={index * 110}>
              <article className="group cursor-pointer overflow-hidden border border-[#c3c6d0] bg-white transition-all hover:border-[#001836]">
                <div className="h-64 overflow-hidden">
                  <img
                    src={article.image}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    width={640}
                    height={360}
                    loading="lazy"
                  />
                </div>
                <div className="p-8">
                  <span className="mb-3 block text-xs font-medium uppercase text-[#43474f]">
                    {article.category}
                  </span>
                  <h3 className="le-display mb-4 text-2xl leading-snug text-[#001836]">
                    {article.title}
                  </h3>
                  <p className="mb-6 line-clamp-2 text-[#43474f]">{article.excerpt}</p>
                  <span className="flex items-center gap-2 text-xs font-medium text-[#001836]">
                    Đọc thêm
                    <span className="material-symbols-outlined text-sm" aria-hidden="true">
                      trending_flat
                    </span>
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

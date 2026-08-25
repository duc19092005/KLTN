import React, { useState } from 'react';
import { FAQS } from '../data/homeContent';
import Reveal from './Reveal';
import { Sparkles, ChevronDown, HelpCircle, PhoneCall, CheckCircle2 } from 'lucide-react';

export default function NewsSection() {
  const [openIndex, setOpenIndex] = useState(0);

  const toggle = (idx) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="hoi-dap" className="bg-slate-50/50 py-20 border-t border-slate-200/60 antialiased" aria-labelledby="faq-heading">
      <div className="mx-auto max-w-[1000px] px-4 sm:px-8">
        
        <Reveal variant="up" className="mb-14 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider text-sky-800 mb-3 border border-sky-200/80 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-sky-600" />
            <span>Giải Đáp Thắc Mắc Thường Gặp</span>
          </span>
          <h2 id="faq-heading" className="text-3xl font-black text-slate-900 sm:text-4xl tracking-tight leading-tight">
            Những Câu Hỏi Thường Gặp Khi Đi Khám
          </h2>
          <p className="mt-2 text-sm text-slate-600 max-w-xl mx-auto font-medium leading-relaxed">
            Mọi thông tin về chi phí, quyền lợi bảo hiểm và thủ tục thăm khám đều được giải đáp rõ ràng, minh bạch.
          </p>
        </Reveal>

        <div className="space-y-4">
          {FAQS.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <Reveal key={faq.q} variant="up" delay={index * 70}>
                <div
                  className={`rounded-3xl border transition-all duration-300 overflow-hidden ${
                    isOpen
                      ? 'border-sky-300 bg-white shadow-md ring-2 ring-sky-100/50'
                      : 'border-slate-200/80 bg-white shadow-xs hover:border-slate-300'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggle(index)}
                    className="flex w-full items-center justify-between gap-4 p-5 sm:p-6 text-left cursor-pointer transition-colors"
                  >
                    <span className="flex items-center gap-3 text-sm sm:text-base font-extrabold text-slate-900">
                      <HelpCircle className={`w-5 h-5 shrink-0 ${isOpen ? 'text-sky-600' : 'text-slate-400'}`} />
                      <span>{faq.q}</span>
                    </span>
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 ${
                        isOpen ? 'bg-sky-50 text-sky-600 rotate-180' : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-6 pb-6 pt-1 text-xs sm:text-sm text-slate-600 font-medium leading-relaxed border-t border-slate-100/80 animate-in fade-in duration-200">
                      <div className="flex gap-3 items-start bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
                        <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0 mt-0.5" />
                        <p className="text-slate-700">{faq.a}</p>
                      </div>
                    </div>
                  )}
                </div>
              </Reveal>
            );
          })}
        </div>

        {/* Contact Support Prompt */}
        <Reveal variant="up" delay={300} className="mt-10 text-center">
          <div className="inline-flex flex-col sm:flex-row items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50/80 p-4 px-6 shadow-2xs">
            <span className="text-xs font-bold text-sky-900">Bạn còn câu hỏi khác cần tư vấn trực tiếp?</span>
            <a
              href="tel:19001234"
              className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-sky-700 transition shadow-xs"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Gọi Tổng đài 1900 1234</span>
            </a>
          </div>
        </Reveal>

      </div>
    </section>
  );
}

import React from 'react';
import { SPECIALITIES } from '../data/homeContent';

export default function SpecialitiesSection() {
  return (
    <section id="chuyen-khoa" className="border-y border-slate-200 bg-white" aria-labelledby="specialities-heading">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-800">Chuyên khoa mũi nhọn</p>
            <h2 id="specialities-heading" className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Thế mạnh điều trị của chúng tôi
            </h2>
            <p className="mt-3 text-base font-semibold leading-relaxed text-slate-700">
              Các chuyên khoa được đầu tư đội ngũ và quy trình chăm sóc chuẩn hóa.
            </p>
          </div>
          <a
            href="#dat-lich"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-50 px-4 text-sm font-bold text-blue-900 ring-1 ring-blue-100 transition duration-150 hover:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Đặt lịch theo chuyên khoa
          </a>
        </div>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {SPECIALITIES.map((item) => (
            <li key={item.id}>
              <article className="flex h-full min-h-[160px] flex-col rounded-2xl bg-slate-50 p-6 shadow-sm ring-1 ring-slate-200 transition duration-150 ease-out hover:scale-[1.01] hover:bg-white hover:shadow-md hover:ring-blue-200">
                <p className="text-xs font-bold uppercase tracking-wide text-blue-800">{item.focus}</p>
                <h3 className="mt-3 text-xl font-bold text-slate-950">{item.title}</h3>
                <p className="mt-3 flex-1 text-base font-semibold leading-relaxed text-slate-700">{item.description}</p>
                <a
                  href="#dat-lich"
                  className="mt-5 inline-flex min-h-11 w-fit items-center rounded-xl px-1 text-sm font-bold text-blue-800 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                >
                  Đặt lịch chuyên khoa này
                </a>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

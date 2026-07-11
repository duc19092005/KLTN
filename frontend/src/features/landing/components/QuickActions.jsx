import React from 'react';
import { CalendarDays, ClipboardList, MessageCircleHeart, Stethoscope } from 'lucide-react';
import { QUICK_ACTIONS } from '../data/homeContent';

const ICONS = {
  stethoscope: Stethoscope,
  clipboard: ClipboardList,
  calendar: CalendarDays,
  message: MessageCircleHeart,
};

export default function QuickActions() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8" aria-labelledby="quick-actions-heading">
      <div className="max-w-2xl">
        <h2 id="quick-actions-heading" className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          Tiện ích nhanh
        </h2>
        <p className="mt-3 text-base font-semibold leading-relaxed text-slate-700">
          Các lối tắt thường dùng — thao tác lớn, dễ bấm trên điện thoại.
        </p>
      </div>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {QUICK_ACTIONS.map((action) => {
          const Icon = ICONS[action.icon] || Stethoscope;
          return (
            <li key={action.id}>
              <a
                href={action.href}
                className="group flex h-full min-h-[132px] flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition duration-150 ease-out hover:scale-[1.015] hover:bg-slate-50 hover:shadow-md hover:ring-blue-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-800 ring-1 ring-blue-100 transition duration-150 group-hover:bg-blue-100">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="mt-4 text-base font-bold text-slate-950">{action.title}</span>
                <span className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">{action.description}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

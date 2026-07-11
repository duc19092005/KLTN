import React from 'react';
import { DOCTORS_PREVIEW, PRICING_PREVIEW } from '../data/homeContent';

export default function DoctorsPricingSection() {
  return (
    <div className="mx-auto grid max-w-6xl gap-12 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-2 lg:px-8">
      <section id="doi-ngu" aria-labelledby="doctors-heading">
        <p className="text-xs font-bold uppercase tracking-wider text-blue-800">Đội ngũ bác sĩ</p>
        <h2 id="doctors-heading" className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          Bác sĩ đồng hành cùng bạn
        </h2>
        <p className="mt-3 text-base font-semibold leading-relaxed text-slate-700">
          Danh sách giới thiệu. Khi đến viện, lễ tân sẽ hỗ trợ chọn bác sĩ và khung giờ phù hợp.
        </p>
        <ul className="mt-6 space-y-3">
          {DOCTORS_PREVIEW.map((doctor) => (
            <li
              key={doctor.name}
              className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition duration-150 hover:bg-slate-50"
            >
              <p className="text-base font-bold text-slate-950">{doctor.name}</p>
              <p className="mt-1 text-sm font-semibold text-blue-900">{doctor.specialty}</p>
              <p className="mt-1 text-sm font-semibold text-slate-600">{doctor.years}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="bang-gia" aria-labelledby="pricing-heading">
        <p className="text-xs font-bold uppercase tracking-wider text-blue-800">Bảng giá tham khảo</p>
        <h2 id="pricing-heading" className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          Minh bạch chi phí
        </h2>
        <p className="mt-3 text-base font-semibold leading-relaxed text-slate-700">
          Mức giá có thể thay đổi theo gói và chỉ định thực tế. Quầy tư vấn sẽ báo rõ trước khi thực hiện.
        </p>
        <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="w-full text-left text-base">
            <caption className="sr-only">Bảng giá dịch vụ khám tham khảo</caption>
            <thead className="bg-slate-100 text-sm font-bold uppercase tracking-wide text-slate-700">
              <tr>
                <th scope="col" className="px-4 py-3">Dịch vụ</th>
                <th scope="col" className="px-4 py-3">Mức giá</th>
              </tr>
            </thead>
            <tbody>
              {PRICING_PREVIEW.map((row) => (
                <tr key={row.item} className="border-t border-slate-100">
                  <td className="px-4 py-4 font-semibold text-slate-900">{row.item}</td>
                  <td className="px-4 py-4 font-bold text-blue-900">{row.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

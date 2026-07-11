import React, { useState } from 'react';
import { Button, FormField, Input, Select } from '../../../shared/components/ui';

export default function BookingCtaSection() {
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    specialty: 'Tim mạch',
    note: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const onChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const onSubmit = (event) => {
    event.preventDefault();
    // Public marketing CTA — actual booking is handled at reception / patient app.
    setSubmitted(true);
  };

  return (
    <section id="dat-lich" className="border-y border-slate-200 bg-blue-900 text-white" aria-labelledby="booking-heading">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-2 lg:items-center lg:px-8">
        <div>
          <h2 id="booking-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
            Đặt lịch khám
          </h2>
          <p className="mt-4 text-base font-semibold leading-relaxed text-blue-100">
            Để lại thông tin, bộ phận chăm sóc khách hàng sẽ liên hệ xác nhận khung giờ.
            Trường hợp cấp cứu, vui lòng gọi hotline đỏ 24/7.
          </p>
          <a
            href="tel:19001155"
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-rose-600 px-5 text-base font-bold text-white shadow-sm transition duration-150 hover:bg-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Gọi cấp cứu: 1900 1155
          </a>
        </div>

        <form onSubmit={onSubmit} className="rounded-3xl bg-white p-5 text-slate-900 shadow-xl sm:p-6" noValidate>
          {submitted ? (
            <div className="space-y-3 py-6 text-center" role="status">
              <p className="text-lg font-bold text-slate-950">Đã ghi nhận yêu cầu</p>
              <p className="text-base font-semibold text-slate-700">
                Nhân viên sẽ gọi lại trong giờ hành chính. Cảm ơn bạn đã tin tưởng bệnh viện.
              </p>
              <Button type="button" variant="secondary" className="min-h-11" onClick={() => setSubmitted(false)}>
                Gửi yêu cầu khác
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <FormField label="Họ và tên" htmlFor="booking-name">
                <Input
                  id="booking-name"
                  name="fullName"
                  required
                  autoComplete="name"
                  value={form.fullName}
                  onChange={onChange('fullName')}
                  className="min-h-12 text-base border-slate-300"
                  placeholder="Nguyễn Văn A"
                />
              </FormField>
              <FormField label="Số điện thoại" htmlFor="booking-phone">
                <Input
                  id="booking-phone"
                  name="phone"
                  type="tel"
                  required
                  inputMode="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={onChange('phone')}
                  className="min-h-12 text-base border-slate-300"
                  placeholder="09xx xxx xxx"
                />
              </FormField>
              <FormField label="Chuyên khoa quan tâm" htmlFor="booking-specialty">
                <Select
                  id="booking-specialty"
                  name="specialty"
                  value={form.specialty}
                  onChange={onChange('specialty')}
                  className="min-h-12 text-base border-slate-300"
                >
                  <option>Sản – Nhi</option>
                  <option>Tim mạch</option>
                  <option>Cơ xương khớp</option>
                  <option>Ung bướu</option>
                  <option>Nội tổng quát</option>
                </Select>
              </FormField>
              <FormField label="Ghi chú (tuỳ chọn)" htmlFor="booking-note">
                <Input
                  id="booking-note"
                  name="note"
                  value={form.note}
                  onChange={onChange('note')}
                  className="min-h-12 text-base border-slate-300"
                  placeholder="Buổi sáng / chiều, bác sĩ ưu tiên…"
                />
              </FormField>
              <Button type="submit" className="min-h-12 w-full justify-center bg-blue-800 text-base font-bold hover:bg-blue-900">
                Gửi yêu cầu đặt lịch
              </Button>
              <p className="text-xs font-semibold leading-relaxed text-slate-600">
                Bằng việc gửi form, bạn đồng ý để bệnh viện liên hệ tư vấn lịch khám. Không dùng form này cho tình huống cấp cứu.
              </p>
            </div>
          )}
        </form>
      </div>
    </section>
  );
}

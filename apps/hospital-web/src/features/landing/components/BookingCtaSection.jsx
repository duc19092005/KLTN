import React, { useState } from 'react';
import Reveal from './Reveal';
import { useToast } from '../../../providers/ToastProvider';
import { PhoneCall, CalendarCheck, Clock, ShieldCheck, Send, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function BookingCtaSection() {
  const toast = useToast();
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    specialty: 'Tim mạch',
    preferredDate: '',
    note: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.fullName || !form.phone) {
      toast.error('Vui lòng nhập Họ tên và Số điện thoại liên hệ.');
      return;
    }
    setSubmitted(true);
    toast.success('Đã gửi thông tin đặt lịch hẹn thành công! Bộ phận Lễ tân sẽ gọi tư vấn trong 5 phút.');
  };

  return (
    <section id="lien-he" className="relative overflow-hidden bg-white py-20 border-t border-slate-100 antialiased" aria-labelledby="contact-heading">
      <div className="relative z-10 mx-auto max-w-[1280px] px-4 sm:px-6">
        <div className="rounded-3xl border border-sky-900 bg-gradient-to-br from-slate-900 via-slate-950 to-sky-950 p-8 sm:p-12 text-white shadow-2xl relative overflow-hidden">
          {/* Ambient Lighting Accents */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-96 w-96 rounded-full bg-sky-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -left-20 -bottom-20 h-96 w-96 rounded-full bg-emerald-500/15 blur-3xl" />

          <div className="relative z-10 grid grid-cols-1 gap-10 lg:grid-cols-12 items-center">
            {/* Left Info Column */}
            <div className="lg:col-span-6 space-y-6">
              <Reveal variant="up">
                <span className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-sky-300 backdrop-blur-md">
                  <Clock className="w-3.5 h-3.5 text-sky-400" />
                  <span>Đồng Hành Cùng Sức Khỏe Gia Đình Bạn</span>
                </span>
                <h2 id="contact-heading" className="mt-3 text-3xl font-extrabold sm:text-4xl leading-tight text-white tracking-tight">
                  Đăng Ký Đặt Lịch Khám Bệnh Trực Tuyến
                </h2>
                <p className="mt-3 text-sm text-slate-300 leading-relaxed font-medium">
                  Đội ngũ Lễ tân & Y bác sĩ Bệnh viện KLTN luôn sẵn sàng tiếp đón và tư vấn chi tiết. Vui lòng để lại thông tin để được hỗ trợ ưu tiên.
                </p>
              </Reveal>

              <Reveal variant="up" delay={100} className="space-y-4 pt-2">
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/10 border border-white/10 backdrop-blur-md">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white shadow-md">
                    <PhoneCall className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-sky-300 block">Tổng đài Tư vấn & Đặt hẹn</span>
                    <a href="tel:19001234" className="text-xl font-black text-white hover:text-sky-300 transition">1900 1234</a>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 backdrop-blur-md">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white shadow-md">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-rose-300 block">Hotline Cấp cứu 24/7</span>
                    <a href="tel:02838111222" className="text-xl font-black text-white hover:text-rose-300 transition">(028) 38 111 222</a>
                  </div>
                </div>
              </Reveal>
            </div>

            {/* Right Booking Form Column */}
            <div className="lg:col-span-6">
              <Reveal variant="up" delay={160}>
                <div className="rounded-3xl border border-white/15 bg-white/95 p-6 sm:p-8 text-slate-900 shadow-xl backdrop-blur-md">
                  <h3 className="text-xl font-extrabold text-slate-900 mb-1 flex items-center gap-2">
                    <CalendarCheck className="w-5 h-5 text-sky-600" />
                    <span>Phiếu Đăng Ký Khám Bệnh</span>
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold mb-6">Miễn phí đặt chỗ ưu tiên · Giảm thời gian chờ đợi tại viện</p>

                  {submitted ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center space-y-3">
                      <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                      <h4 className="text-base font-bold text-emerald-950">Đã gửi phiếu đăng ký thành công!</h4>
                      <p className="text-xs text-emerald-800 font-semibold leading-relaxed">
                        Cảm ơn quý khách <strong>{form.fullName}</strong>. Bộ phận tiếp đón bệnh viện sẽ liên hệ số điện thoại <strong>{form.phone}</strong> trong vòng 5 phút để xác nhận khung giờ khám.
                      </p>
                      <button
                        type="button"
                        onClick={() => { setSubmitted(false); setForm({ fullName: '', phone: '', specialty: 'Tim mạch', preferredDate: '', note: '' }); }}
                        className="mt-2 text-xs font-bold text-sky-700 underline"
                      >
                        Đăng ký lịch hẹn khác
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Họ và tên bệnh nhân *
                        </label>
                        <input
                          type="text"
                          required
                          value={form.fullName}
                          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                          placeholder="Ví dụ: Nguyễn Văn An"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:border-sky-500 focus:bg-white outline-none transition"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                            Số điện thoại liên hệ *
                          </label>
                          <input
                            type="tel"
                            required
                            value={form.phone}
                            onChange={(e) => setForm({ ...form, phone: e.target.value })}
                            placeholder="Ví dụ: 0901234567"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:border-sky-500 focus:bg-white outline-none transition"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                            Chọn Chuyên khoa
                          </label>
                          <select
                            value={form.specialty}
                            onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:border-sky-500 focus:bg-white outline-none transition"
                          >
                            <option value="Tim mạch">Khoa Tim mạch</option>
                            <option value="Sản phụ">Khoa Sản Phụ khoa</option>
                            <option value="Nhi khoa">Khoa Nhi</option>
                            <option value="Cơ xương khớp">Khoa Cơ Xương Khớp</option>
                            <option value="Ung bướu">Khoa Ung Bướu</option>
                            <option value="Thần kinh">Khoa Thần Kinh</option>
                            <option value="Tổng quát">Khám Tổng Quát</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Ngày khám mong muốn (Tùy chọn)
                        </label>
                        <input
                          type="date"
                          value={form.preferredDate}
                          onChange={(e) => setForm({ ...form, preferredDate: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:border-sky-500 focus:bg-white outline-none transition"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Ghi chú triệu chứng
                        </label>
                        <textarea
                          rows={2}
                          value={form.note}
                          onChange={(e) => setForm({ ...form, note: e.target.value })}
                          placeholder="Mô tả sơ lược triệu chứng hoặc yêu cầu bác sĩ thăm khám..."
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-900 focus:border-sky-500 focus:bg-white outline-none transition resize-none"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full rounded-2xl bg-sky-600 hover:bg-sky-700 py-3.5 text-xs font-bold uppercase tracking-wider text-white transition shadow-md shadow-sky-600/30 flex items-center justify-center gap-2"
                      >
                        <Send className="w-4 h-4" />
                        <span>Gửi phiếu đăng ký hẹn khám</span>
                      </button>
                    </form>
                  )}
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

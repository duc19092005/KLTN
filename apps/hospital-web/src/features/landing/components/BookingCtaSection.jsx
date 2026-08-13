import React, { useState } from 'react';
import Reveal from './Reveal';
import { useToast } from '../../../providers/ToastProvider';
import { PhoneCall, CalendarCheck, Clock, ShieldCheck, Send, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';

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
    toast.success('Đã gửi thông tin đăng ký thành công! Bộ phận Lễ tân sẽ liên hệ xác nhận trong 5 phút.');
  };

  return (
    <section id="lien-he" className="relative overflow-hidden bg-slate-50/50 py-20 border-t border-slate-100 antialiased" aria-labelledby="contact-heading">
      <div className="relative z-10 mx-auto max-w-[1400px] px-4 sm:px-8">
        <div className="rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50/80 via-white to-cyan-50/70 p-7 sm:p-11 text-slate-900 shadow-sm relative overflow-hidden">
          
          <div className="relative z-10 grid grid-cols-1 gap-10 lg:grid-cols-12 items-center">
            {/* Left Info Column */}
            <div className="lg:col-span-6 space-y-6">
              <Reveal variant="up">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-100/70 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-sky-800">
                  <Clock className="w-3 h-3 text-sky-600" />
                  <span>Đồng Hành Cùng Sức Khỏe Gia Đình Bạn</span>
                </span>
                <h2 id="contact-heading" className="mt-2.5 text-lg sm:text-xl font-bold leading-snug text-slate-900 tracking-tight">
                  Đăng Ký Đặt Lịch Khám Bệnh Trực Tuyến
                </h2>
                <p className="mt-1.5 text-xs text-slate-600 leading-relaxed font-medium">
                  Đội ngũ Lễ tân & Y bác sĩ Bệnh viện KLTN luôn sẵn sàng tiếp đón và tư vấn chi tiết. Vui lòng để lại thông tin để nhận số khám ưu tiên.
                </p>
              </Reveal>

              <Reveal variant="up" delay={100} className="space-y-3.5 pt-1">
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-sky-100 shadow-2xs">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white shadow-xs">
                    <PhoneCall className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">Tổng đài Tư vấn & Đặt hẹn</span>
                    <a href="tel:19001234" className="text-xl font-bold text-sky-600 hover:text-sky-700 transition">1900 1234</a>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-2xl bg-rose-50/80 border border-rose-100 shadow-2xs">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white shadow-xs">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 block">Hotline Cấp cứu 24/7</span>
                    <a href="tel:02838111222" className="text-xl font-bold text-rose-700 hover:underline transition">(028) 38 111 222</a>
                  </div>
                </div>
              </Reveal>
            </div>

            {/* Right Booking Form Column */}
            <div className="lg:col-span-6">
              <Reveal variant="up" delay={160}>
                <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 text-slate-900 shadow-md">
                  <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
                    <CalendarCheck className="w-5 h-5 text-sky-600" />
                    <span>Phiếu Đăng Ký Khám Bệnh Ưu Tiên</span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mb-5">Miễn phí giữ chỗ · Rút ngắn thời gian chờ đợi tại bệnh viện</p>

                  {submitted ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center space-y-3">
                      <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                      <h4 className="text-sm font-bold text-emerald-950">Đã gửi phiếu đăng ký thành công!</h4>
                      <p className="text-xs text-emerald-800 font-medium leading-relaxed">
                        Cảm ơn quý khách <strong>{form.fullName}</strong>. Bộ phận tiếp đón bệnh viện sẽ liên hệ số điện thoại <strong>{form.phone}</strong> trong vòng 5 phút để xác nhận khung giờ khám.
                      </p>
                      <button
                        type="button"
                        onClick={() => { setSubmitted(false); setForm({ fullName: '', phone: '', specialty: 'Tim mạch', preferredDate: '', note: '' }); }}
                        className="mt-1 text-xs font-bold text-sky-700 underline hover:text-sky-800"
                      >
                        Đăng ký lịch hẹn khác
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-3.5">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Họ và tên người bệnh (*)</label>
                        <input
                          type="text"
                          required
                          value={form.fullName}
                          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                          placeholder="Nguyễn Văn A"
                          className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs font-semibold text-slate-900 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Số điện thoại (*)</label>
                          <input
                            type="tel"
                            required
                            value={form.phone}
                            onChange={(e) => setForm({ ...form, phone: e.target.value })}
                            placeholder="090xxxxxxx"
                            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs font-semibold text-slate-900 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Chuyên khoa khám</label>
                          <select
                            value={form.specialty}
                            onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-900 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
                          >
                            <option value="Tim mạch">Trung tâm Tim mạch</option>
                            <option value="Sản phụ khoa">Khoa Sản phụ & Nhi khoa</option>
                            <option value="Cơ xương khớp">Khoa Cơ xương khớp</option>
                            <option value="Ung bướu">Khoa Ung bướu & Tầm soát</option>
                            <option value="Thần kinh">Khoa Thần kinh</option>
                            <option value="Khám tổng quát">Khám sức khỏe tổng quát</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Ngày dự định khám</label>
                        <input
                          type="date"
                          value={form.preferredDate}
                          onChange={(e) => setForm({ ...form, preferredDate: e.target.value })}
                          className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs font-semibold text-slate-900 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Ghi chú thêm (Triệu chứng, yêu cầu bác sĩ)</label>
                        <textarea
                          rows={2}
                          value={form.note}
                          onChange={(e) => setForm({ ...form, note: e.target.value })}
                          placeholder="Mô tả triệu chứng ban đầu nếu có..."
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-900 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
                        />
                      </div>

                      <button
                        type="submit"
                        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-600 text-xs font-bold uppercase tracking-wider text-white hover:bg-sky-700 transition-all shadow-xs"
                      >
                        <Send className="w-4 h-4" />
                        <span>Xác Nhận Đăng Ký Khám</span>
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

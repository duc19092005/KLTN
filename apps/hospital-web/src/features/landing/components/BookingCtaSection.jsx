import React, { useState } from 'react';
import Reveal from './Reveal';
import { useToast } from '../../../providers/ToastProvider';
import {
  PhoneCall,
  CalendarCheck,
  Clock,
  ShieldCheck,
  Send,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  MapPin,
  HeartHandshake,
} from 'lucide-react';

export default function BookingCtaSection() {
  const toast = useToast();
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    specialty: 'Tim Mạch & Huyết Áp',
    preferredDate: '',
    note: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.fullName.trim() || !form.phone.trim()) {
      toast.error('Vui lòng nhập Họ tên và Số điện thoại liên hệ.');
      return;
    }
    setSubmitted(true);
    toast.success('Đã gửi thông tin đăng ký! Nhân viên tiếp đón sẽ liên hệ xác nhận lịch khám trong 5 phút.');
  };

  return (
    <section id="lien-he" className="relative overflow-hidden bg-white py-20 border-t border-slate-200/60 antialiased" aria-labelledby="contact-heading">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-8">
        <div className="rounded-3xl border border-slate-200/90 bg-gradient-to-br from-slate-50/70 via-white to-sky-50/40 p-7 sm:p-12 text-slate-900 shadow-lg relative overflow-hidden">
          
          <div className="relative z-10 grid grid-cols-1 gap-12 lg:grid-cols-12 items-center">
            
            {/* Left Info Column */}
            <div className="lg:col-span-6 space-y-6">
              <Reveal variant="up">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3.5 py-1 text-xs font-extrabold uppercase tracking-wider text-sky-800 shadow-2xs">
                  <Clock className="w-3.5 h-3.5 text-sky-600" />
                  <span>Đăng Ký Khám Ưu Tiên</span>
                </span>
                <h2 id="contact-heading" className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-black leading-tight text-slate-900 tracking-tight">
                  Đặt Lịch Khám Ngay — Giữ Chỗ Nhanh Chóng Trong 1 Phút
                </h2>
                <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                  Để lại thông tin bên cạnh, bộ phận tiếp đón của bệnh viện sẽ liên hệ lại ngay trong vòng 5 phút để xác nhận khung giờ khám và chuẩn bị sẵn hồ sơ tiếp đón bạn chu đáo.
                </p>
              </Reveal>

              <Reveal variant="up" delay={80} className="space-y-3.5 pt-2">
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-xs">
                    <PhoneCall className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Tổng đài Tư vấn & Đặt hẹn miễn phí</span>
                    <a href="tel:19001234" className="text-xl font-black text-sky-600 hover:text-sky-700 transition font-mono">1900 1234</a>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-rose-200 shadow-2xs">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-xs">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-500 block">Hotline Cấp cứu & Khám 24/7</span>
                    <a href="tel:02838111222" className="text-xl font-black text-rose-700 hover:underline transition font-mono">(028) 38 111 222</a>
                  </div>
                </div>
              </Reveal>

              <Reveal variant="up" delay={140}>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 pt-2">
                  <MapPin className="w-4 h-4 text-sky-600 shrink-0" />
                  <span>Địa chỉ: Số 123 Nguyễn Văn Cừ, Phường 4, Quận 5, TP. Hồ Chí Minh</span>
                </div>
              </Reveal>
            </div>

            {/* Right Booking Form Column */}
            <div className="lg:col-span-6">
              <Reveal variant="scale" delay={120}>
                <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 text-slate-900 shadow-xl">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                      <CalendarCheck className="w-5 h-5 text-sky-600" />
                      <span>Phiếu Đăng Ký Khám Bệnh</span>
                    </h3>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-700 border border-emerald-200">
                      Miễn phí giữ chỗ
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mb-6">Đến viện vào khám ngay theo đúng giờ đã hẹn</p>

                  {submitted ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-7 text-center space-y-3.5 animate-in fade-in">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white mx-auto shadow-xs">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <h4 className="text-base font-extrabold text-emerald-950">Đã gửi thông tin đăng ký thành công!</h4>
                      <p className="text-xs text-emerald-800 font-medium leading-relaxed">
                        Cảm ơn quý khách <strong>{form.fullName}</strong>. Bộ phận tiếp đón của Bệnh viện KLTN sẽ liên hệ số điện thoại <strong>{form.phone}</strong> trong vòng 5 phút để xác nhận khung giờ khám chính xác.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setSubmitted(false);
                          setForm({ fullName: '', phone: '', specialty: 'Tim Mạch & Huyết Áp', preferredDate: '', note: '' });
                        }}
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-sky-700 underline hover:text-sky-800 cursor-pointer"
                      >
                        Đăng ký thêm lịch hẹn khác
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Họ và tên người bệnh (*)</label>
                        <input
                          type="text"
                          required
                          value={form.fullName}
                          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                          placeholder="Ví dụ: Nguyễn Văn An"
                          className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 text-xs sm:text-sm font-semibold text-slate-900 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 transition-all"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1.5">Số điện thoại liên hệ (*)</label>
                          <input
                            type="tel"
                            required
                            value={form.phone}
                            onChange={(e) => setForm({ ...form, phone: e.target.value })}
                            placeholder="090xxxxxxx"
                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 text-xs sm:text-sm font-semibold text-slate-900 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1.5">Chuyên khoa khám</label>
                          <select
                            value={form.specialty}
                            onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 text-xs sm:text-sm font-semibold text-slate-900 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 transition-all cursor-pointer"
                          >
                            <option value="Tim Mạch & Huyết Áp">Khoa Tim Mạch & Huyết Áp</option>
                            <option value="Sản Phụ Khoa & Nhi">Khoa Sản Phụ & Nhi Khoa</option>
                            <option value="Tiêu Hóa & Gan Mật">Khoa Tiêu Hóa & Gan Mật</option>
                            <option value="Cơ Xương Khớp & Cột Sống">Khoa Cơ Xương Khớp & Cột Sống</option>
                            <option value="Tai Mũi Họng & Hô Hấp">Khoa Tai Mũi Họng & Hô Hấp</option>
                            <option value="Mắt & Răng Hàm Mặt">Khoa Mắt & Răng Hàm Mặt</option>
                            <option value="Khám Sức Khỏe Tổng Quát">Gói Khám Sức Khỏe Tổng Quát</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Ngày dự định đến khám</label>
                        <input
                          type="date"
                          value={form.preferredDate}
                          onChange={(e) => setForm({ ...form, preferredDate: e.target.value })}
                          className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 text-xs sm:text-sm font-semibold text-slate-900 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 transition-all cursor-pointer"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Triệu chứng hoặc yêu cầu bác sĩ (nếu có)</label>
                        <textarea
                          rows={2}
                          value={form.note}
                          onChange={(e) => setForm({ ...form, note: e.target.value })}
                          placeholder="Mô tả sơ qua cảm giác đau, sốt, ho hoặc bác sĩ bạn muốn khám..."
                          className="w-full rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs sm:text-sm font-semibold text-slate-900 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 transition-all"
                        />
                      </div>

                      <button
                        type="submit"
                        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 to-sky-700 text-xs font-extrabold uppercase tracking-wider text-white hover:from-sky-700 hover:to-sky-800 transition-all shadow-md hover:scale-[1.02] active:scale-98 cursor-pointer"
                      >
                        <Send className="w-4 h-4" />
                        <span>Xác Nhận Đăng Ký Lịch Khám</span>
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

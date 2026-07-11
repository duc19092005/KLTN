import React from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Activity,
  Building2,
  CalendarHeart,
  Clock3,
  HeartPulse,
  LogIn,
  Phone,
  ShieldCheck,
  Stethoscope,
  Users,
} from 'lucide-react';
import { LoginPage } from '../../auth';

const SERVICES = [
  {
    icon: Stethoscope,
    title: 'Khám bệnh & điều trị',
    desc: 'Tiếp nhận, khám lâm sàng và theo dõi quá trình điều trị theo từng bước rõ ràng, nhân viên hỗ trợ tận tình.',
  },
  {
    icon: Activity,
    title: 'Xét nghiệm & chẩn đoán hình ảnh',
    desc: 'Hệ thống cận lâm sàng hiện đại, trả kết quả có kiểm soát, bác sĩ giải thích dễ hiểu cho người bệnh.',
  },
  {
    icon: CalendarHeart,
    title: 'Đặt lịch & chăm sóc liên tục',
    desc: 'Hẹn khám, theo dõi lịch sử điều trị và nhận thông tin nhắc nhở qua cổng bệnh nhân (ứng dụng điện thoại).',
  },
  {
    icon: ShieldCheck,
    title: 'An toàn & tin cậy',
    desc: 'Hồ sơ được bảo vệ nghiêm ngặt. Mọi thay đổi quan trọng được ghi nhận để bảo vệ quyền lợi người bệnh.',
  },
];

const STEPS = [
  { step: '01', title: 'Đăng ký / check-in', desc: 'Lễ tân tiếp nhận thông tin, xác nhận lịch hẹn hoặc tạo lượt khám mới.' },
  { step: '02', title: 'Khám với bác sĩ', desc: 'Bác sĩ thăm khám, chỉ định cận lâm sàng nếu cần và tư vấn phương án điều trị.' },
  { step: '03', title: 'Trả kết quả & kết luận', desc: 'Nhận kết quả xét nghiệm/hình ảnh và kết luận cuối cùng kèm hướng dẫn theo dõi.' },
];

export default function HospitalLandingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const showLogin = searchParams.get('login') === 'true';
  const initialMode = searchParams.get('tab') || 'staff';

  const openLogin = (tab = 'staff') => setSearchParams({ login: 'true', tab });
  const closeLogin = () => setSearchParams({});

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased">
      <header className="sticky top-0 z-40 border-b border-cyan-100/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:h-20 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-600 text-white shadow-sm">
              <HeartPulse className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-black tracking-tight text-slate-950 sm:text-base">Bệnh viện KLTN</p>
              <p className="hidden text-[11px] font-semibold text-slate-500 sm:block">Chăm sóc tận tâm · An toàn · Minh bạch</p>
            </div>
          </div>
          <nav className="hidden items-center gap-6 text-sm font-bold text-slate-600 md:flex">
            <a href="#services" className="hover:text-cyan-700">Dịch vụ</a>
            <a href="#journey" className="hover:text-cyan-700">Quy trình khám</a>
            <a href="#about" className="hover:text-cyan-700">Về chúng tôi</a>
            <a href="#contact" className="hover:text-cyan-700">Liên hệ</a>
          </nav>
          <button
            type="button"
            onClick={() => openLogin('staff')}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-black text-white shadow-sm hover:bg-cyan-700"
          >
            <LogIn className="h-4 w-4" />
            <span className="hidden sm:inline">Cổng nhân sự</span>
            <span className="sm:hidden">Đăng nhập</span>
          </button>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-cyan-50 bg-gradient-to-br from-white via-cyan-50/70 to-slate-50">
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-cyan-200/40 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-teal-100/50 blur-3xl" />
          <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-20">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-cyan-100 bg-white/80 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-cyan-700">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
                Hệ thống quản lý bệnh viện
              </p>
              <h1 className="mt-5 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
                Đồng hành cùng sức khỏe
                <span className="block text-cyan-700">mọi bước trên hành trình chữa lành</span>
              </h1>
              <p className="mt-5 max-w-xl text-base font-semibold leading-relaxed text-slate-600 sm:text-lg">
                Chúng tôi xây dựng môi trường khám chữa bệnh thân thiện, quy trình rõ ràng và hồ sơ được bảo vệ cẩn thận —
                để người bệnh an tâm, nhân viên làm việc hiệu quả.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="#journey"
                  className="inline-flex items-center justify-center rounded-xl bg-cyan-600 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-cyan-700"
                >
                  Xem quy trình khám
                </a>
                <button
                  type="button"
                  onClick={() => openLogin('staff')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-800"
                >
                  <Users className="h-4 w-4" />
                  Dành cho nhân viên y tế
                </button>
              </div>
              <div className="mt-10 grid grid-cols-3 gap-3 max-w-lg">
                {[
                  { label: 'Phòng ban', value: 'Đa chuyên khoa' },
                  { label: 'Giờ làm việc', value: '7:00 – 17:00' },
                  { label: 'Ưu tiên', value: 'An toàn BN' },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-white/80 bg-white/70 p-3 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{item.label}</p>
                    <p className="mt-1 text-sm font-black text-slate-900">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-cyan-100 bg-white p-6 shadow-xl shadow-cyan-100/50 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-50 text-cyan-700">
                  <Building2 className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-sm font-black text-slate-950">Cam kết của chúng tôi</p>
                  <p className="text-xs font-semibold text-slate-500">Với người bệnh và gia đình</p>
                </div>
              </div>
              <ul className="mt-6 space-y-4">
                {[
                  'Tiếp đón nhanh, hướng dẫn rõ ràng ngay từ sảnh.',
                  'Bác sĩ giải thích bằng ngôn ngữ dễ hiểu, không gây áp lực.',
                  'Kết quả và chỉ định được theo dõi có trách nhiệm.',
                  'Thông tin cá nhân được bảo mật theo quy định bệnh viện.',
                ].map((text) => (
                  <li key={text} className="flex gap-3 text-sm font-semibold leading-relaxed text-slate-600">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-cyan-500" />
                    {text}
                  </li>
                ))}
              </ul>
              <div className="mt-8 rounded-2xl bg-gradient-to-r from-cyan-600 to-teal-600 p-5 text-white">
                <p className="text-xs font-black uppercase tracking-wider text-cyan-100">Người bệnh</p>
                <p className="mt-2 text-sm font-bold leading-relaxed text-white/95">
                  Vui lòng mang theo giấy tờ tùy thân / thẻ BHYT khi đến khám. Hẹn lịch và xem lịch sử điều trị qua ứng dụng bệnh nhân của bệnh viện.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Services */}
        <section id="services" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-600">Dịch vụ</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">Chăm sóc toàn diện trong một hệ thống</h2>
            <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-600 sm:text-base">
              Từ tiếp nhận đến kết luận, mọi bước được phối hợp giữa lễ tân, bác sĩ và kỹ thuật viên để giảm chờ đợi và hạn chế sai sót.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICES.map(({ icon: Icon, title, desc }) => (
              <article key={title} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition hover:border-cyan-100 hover:shadow-md">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-50 text-cyan-700">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-base font-black text-slate-950">{title}</h3>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">{desc}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Journey */}
        <section id="journey" className="border-y border-cyan-50 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-600">Quy trình</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">Ba bước khám đơn giản</h2>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {STEPS.map((item) => (
                <div key={item.step} className="relative rounded-3xl border border-slate-100 bg-slate-50/80 p-6">
                  <p className="text-3xl font-black text-cyan-200">{item.step}</p>
                  <h3 className="mt-3 text-lg font-black text-slate-950">{item.title}</h3>
                  <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* About + hours */}
        <section id="about" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-600">Về bệnh viện</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">Không gian y tế hiện đại, con người là trung tâm</h2>
              <p className="mt-4 text-sm font-semibold leading-relaxed text-slate-600 sm:text-base">
                Bệnh viện KLTN kết hợp quy trình vận hành chuẩn với công nghệ hỗ trợ điều phối nội bộ —
                để nhân viên tập trung vào người bệnh, còn hệ thống lo phần phối hợp, lưu trữ và bảo vệ hồ sơ.
              </p>
              <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-600 sm:text-base">
                Chúng tôi không thay thế quyết định của bác sĩ. Công nghệ chỉ hỗ trợ, minh bạch và an toàn hơn cho mọi bên.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <Clock3 className="h-5 w-5 text-cyan-600" />
                <h3 className="mt-3 text-base font-black text-slate-950">Giờ làm việc</h3>
                <p className="mt-2 text-sm font-semibold text-slate-600">Thứ 2 – Thứ 7</p>
                <p className="text-sm font-black text-slate-900">07:00 – 17:00</p>
                <p className="mt-2 text-xs font-semibold text-slate-500">Cấp cứu / lịch đặc biệt: theo thông báo tại quầy.</p>
              </div>
              <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <Users className="h-5 w-5 text-cyan-600" />
                <h3 className="mt-3 text-base font-black text-slate-950">Đội ngũ</h3>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">
                  Bác sĩ, lễ tân, kỹ thuật viên cận lâm sàng phối hợp trên cùng một hệ thống nội bộ.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="border-t border-cyan-50 bg-gradient-to-br from-cyan-700 to-teal-700 text-white">
          <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-14 sm:px-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-100">Liên hệ</p>
              <h2 className="mt-2 text-2xl font-black sm:text-3xl">Chúng tôi luôn sẵn sàng hỗ trợ</h2>
              <p className="mt-3 max-w-xl text-sm font-semibold text-cyan-50/90">
                Đến trực tiếp quầy lễ tân hoặc gọi tổng đài trong giờ hành chính. Nhân viên sẽ hướng dẫn đăng ký khám và các thủ tục cần thiết.
              </p>
              <div className="mt-5 flex flex-wrap gap-4 text-sm font-bold">
                <span className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2">
                  <Phone className="h-4 w-4" />
                  Tổng đài: 1900-0000
                </span>
                <span className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2">
                  <Building2 className="h-4 w-4" />
                  Quầy tiếp nhận tầng 1
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => openLogin('staff')}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-sm font-black text-cyan-800 shadow-lg hover:bg-cyan-50"
            >
              <LogIn className="h-4 w-4" />
              Đăng nhập cổng nhân sự
            </button>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-100 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs font-semibold text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} Bệnh viện KLTN · Hệ thống quản lý nội bộ</p>
          <p>Thông tin trên trang mang tính giới thiệu chung. Chi tiết điều trị do bác sĩ phụ trách.</p>
        </div>
      </footer>

      {showLogin && (
        <LoginPage
          isModal
          initialMode={initialMode}
          onClose={closeLogin}
        />
      )}
    </div>
  );
}

import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowUpRight, HeartPulse, LogIn } from 'lucide-react';
import { LoginPage } from '../../auth';

/**
 * Brand strategy (from brandkit skill):
 * - Category: hospital / care institution
 * - Metaphor: protected care path — calm, continuous, trustworthy
 * - Visual mode: light editorial + restrained cyan accent (Hospital OS)
 * - Tone: sparse, premium, human — never technical
 * - Tagline: "An tâm từng bước."
 */

const PILLARS = [
  {
    index: '01',
    title: 'Tiếp đón rõ ràng',
    body: 'Từ sảnh đến phòng khám, mọi bước được hướng dẫn gọn, lịch sự và dễ theo.',
  },
  {
    index: '02',
    title: 'Chăm sóc có trách nhiệm',
    body: 'Bác sĩ giải thích dễ hiểu. Chỉ định và kết quả được theo dõi đến khi bạn yên tâm.',
  },
  {
    index: '03',
    title: 'Hồ sơ được bảo vệ',
    body: 'Thông tin cá nhân chỉ dùng cho điều trị. Mọi thay đổi quan trọng đều có người chịu trách nhiệm.',
  },
];

const JOURNEY = [
  { n: '1', title: 'Đăng ký', hint: 'Quầy lễ tân · giấy tờ · BHYT' },
  { n: '2', title: 'Khám', hint: 'Bác sĩ · tư vấn · chỉ định nếu cần' },
  { n: '3', title: 'Kết luận', hint: 'Kết quả · hướng dẫn theo dõi' },
];

export default function HospitalLandingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const showLogin = searchParams.get('login') === 'true';
  const initialMode = searchParams.get('tab') || 'staff';

  const openLogin = (tab = 'staff') => setSearchParams({ login: 'true', tab });
  const closeLogin = () => setSearchParams({});

  return (
    <div className="min-h-screen bg-[#F4F7F8] text-slate-900 antialiased selection:bg-cyan-100 selection:text-cyan-950">
      {/* Outer brand canvas */}
      <div className="mx-auto min-h-screen max-w-[1440px]">
        {/* Top bar — sparse */}
        <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-[#F4F7F8]/85 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:h-[4.5rem] sm:px-8">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-900 text-cyan-300 shadow-sm">
                <HeartPulse className="h-4 w-4" strokeWidth={2.25} />
              </span>
              <div className="leading-none">
                <p className="text-[13px] font-semibold tracking-[-0.02em] text-slate-900">Bệnh viện KLTN</p>
                <p className="mt-1 hidden text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400 sm:block">
                  Care OS
                </p>
              </div>
            </div>

            <nav className="hidden items-center gap-8 text-[13px] font-medium text-slate-500 md:flex">
              <a href="#promise" className="transition hover:text-slate-900">Cam kết</a>
              <a href="#journey" className="transition hover:text-slate-900">Hành trình</a>
              <a href="#visit" className="transition hover:text-slate-900">Đến khám</a>
            </nav>

            <button
              type="button"
              onClick={() => openLogin('staff')}
              className="group inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-[12px] font-semibold tracking-wide text-white transition hover:bg-cyan-800"
            >
              <LogIn className="h-3.5 w-3.5 text-cyan-300 transition group-hover:text-white" />
              Nhân sự
            </button>
          </div>
        </header>

        <main>
          {/* Hero — large quiet cover */}
          <section className="mx-auto max-w-6xl px-5 pb-16 pt-12 sm:px-8 sm:pb-24 sm:pt-16">
            <div className="grid items-end gap-12 lg:grid-cols-12 lg:gap-10">
              <div className="lg:col-span-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-700/80">
                  Hospital brand
                </p>
                <h1 className="mt-6 max-w-xl text-[2.5rem] font-semibold leading-[1.05] tracking-[-0.04em] text-slate-950 sm:text-5xl lg:text-[3.35rem]">
                  An tâm
                  <span className="block text-slate-400">từng bước.</span>
                </h1>
                <p className="mt-7 max-w-md text-[15px] font-medium leading-relaxed text-slate-500 sm:text-base">
                  Không gian khám chữa bệnh trầm tĩnh, quy trình gọn, con người là trung tâm.
                  Công nghệ ở phía sau — bạn chỉ cần được chăm sóc đúng cách.
                </p>
                <div className="mt-10 flex flex-wrap items-center gap-3">
                  <a
                    href="#journey"
                    className="inline-flex items-center gap-2 rounded-full bg-cyan-600 px-5 py-3 text-[13px] font-semibold text-white shadow-sm shadow-cyan-600/20 transition hover:bg-cyan-700"
                  >
                    Xem hành trình khám
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                  <button
                    type="button"
                    onClick={() => openLogin('staff')}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-5 py-3 text-[13px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                  >
                    Cổng nhân sự
                  </button>
                </div>
              </div>

              <div className="lg:col-span-6">
                <div className="relative overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-slate-900 shadow-2xl shadow-slate-900/10">
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-900/10 to-transparent" />
                  <img
                    src="/brand/hospital-hero.jpg"
                    alt=""
                    className="aspect-[4/3] w-full object-cover opacity-95"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentElement.classList.add('min-h-[280px]', 'bg-gradient-to-br', 'from-slate-800', 'via-cyan-950', 'to-slate-900');
                    }}
                  />
                  <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
                      Atmosphere
                    </p>
                    <p className="mt-2 max-w-sm text-lg font-semibold tracking-tight text-white sm:text-xl">
                      Yên tĩnh. Rõ ràng. Đáng tin.
                    </p>
                  </div>
                  {/* Construction marks — brandkit detail */}
                  <div className="pointer-events-none absolute left-4 top-4 h-6 w-6 border-l border-t border-white/30" />
                  <div className="pointer-events-none absolute bottom-4 right-4 h-6 w-6 border-b border-r border-white/30" />
                </div>
              </div>
            </div>
          </section>

          {/* Color / system strip — sparse brand system */}
          <section className="border-y border-slate-200/80 bg-white">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-5 py-6 sm:px-8">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400">Palette</p>
              <div className="flex flex-wrap items-center gap-3">
                {[
                  { name: 'Ink', hex: '#0F172A', className: 'bg-slate-900' },
                  { name: 'Care Cyan', hex: '#0891B2', className: 'bg-cyan-600' },
                  { name: 'Mist', hex: '#F4F7F8', className: 'bg-[#F4F7F8] border border-slate-200' },
                  { name: 'Quiet', hex: '#94A3B8', className: 'bg-slate-400' },
                ].map((c) => (
                  <div key={c.name} className="flex items-center gap-2">
                    <span className={`h-7 w-7 rounded-full ${c.className}`} title={c.hex} />
                    <span className="text-[11px] font-medium text-slate-500">{c.name}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] font-medium text-slate-400">KLTN · Hospital OS</p>
            </div>
          </section>

          {/* Promise — three pillars, editorial cards */}
          <section id="promise" className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
            <div className="max-w-lg">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-700/80">Cam kết</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">
                Ba điều chúng tôi
                <span className="text-slate-400"> giữ vững.</span>
              </h2>
            </div>
            <div className="mt-14 grid gap-px overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-200 sm:grid-cols-3">
              {PILLARS.map((item) => (
                <article key={item.index} className="bg-[#F4F7F8] p-8 sm:bg-white sm:p-10">
                  <p className="font-mono text-[11px] font-medium tracking-widest text-cyan-600">{item.index}</p>
                  <h3 className="mt-6 text-xl font-semibold tracking-tight text-slate-950">{item.title}</h3>
                  <p className="mt-4 text-[14px] font-medium leading-relaxed text-slate-500">{item.body}</p>
                </article>
              ))}
            </div>
          </section>

          {/* Journey — minimal path */}
          <section id="journey" className="border-y border-slate-200/80 bg-white">
            <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
              <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-700/80">Hành trình</p>
                  <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">
                    Ba bước. Một đường đi.
                  </h2>
                </div>
                <p className="max-w-xs text-[13px] font-medium leading-relaxed text-slate-500">
                  Không phức tạp hóa. Bạn luôn biết mình đang ở bước nào.
                </p>
              </div>

              <div className="mt-14 grid gap-6 md:grid-cols-3">
                {JOURNEY.map((item, i) => (
                  <div key={item.n} className="relative">
                    {i < JOURNEY.length - 1 && (
                      <div className="pointer-events-none absolute left-[calc(50%+2rem)] top-8 hidden h-px w-[calc(100%-4rem)] bg-gradient-to-r from-cyan-300 to-slate-200 md:block" />
                    )}
                    <div className="rounded-[1.5rem] border border-slate-100 bg-[#F4F7F8] p-7">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-cyan-300">
                        {item.n}
                      </span>
                      <h3 className="mt-6 text-xl font-semibold tracking-tight text-slate-950">{item.title}</h3>
                      <p className="mt-2 text-[13px] font-medium text-slate-500">{item.hint}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Visit / practical — quiet institutional */}
          <section id="visit" className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
            <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
              <div className="lg:col-span-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-700/80">Đến khám</p>
                <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">
                  Chuẩn bị gọn.
                  <span className="block text-slate-400">Đến là được đón.</span>
                </h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:col-span-7">
                <div className="rounded-[1.5rem] bg-slate-900 p-7 text-white sm:col-span-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-300/80">Giờ hành chính</p>
                  <p className="mt-4 text-3xl font-semibold tracking-tight">07:00 — 17:00</p>
                  <p className="mt-2 text-sm font-medium text-slate-400">Thứ Hai đến Thứ Bảy · Quầy tiếp nhận tầng 1</p>
                </div>
                <div className="rounded-[1.5rem] border border-slate-200 bg-white p-7">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">Mang theo</p>
                  <p className="mt-4 text-[15px] font-semibold leading-relaxed text-slate-700">
                    Giấy tờ tùy thân, thẻ BHYT (nếu có), và các giấy tờ khám gần đây nếu có.
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-slate-200 bg-white p-7">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">Liên hệ</p>
                  <p className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">1900 0000</p>
                  <p className="mt-2 text-sm font-medium text-slate-500">Tổng đài trong giờ làm việc</p>
                </div>
              </div>
            </div>
          </section>

          {/* Closing tagline panel — brand essence */}
          <section className="border-t border-slate-200 bg-slate-900">
            <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-10 px-5 py-20 sm:px-8 sm:py-24 md:flex-row md:items-end">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-400/80">Brand promise</p>
                <p className="mt-6 max-w-xl text-3xl font-semibold leading-[1.15] tracking-[-0.03em] text-white sm:text-4xl lg:text-5xl">
                  Clarity builds
                  <span className="text-cyan-300"> confidence.</span>
                </p>
                <p className="mt-5 max-w-md text-[14px] font-medium leading-relaxed text-slate-400">
                  An tâm từng bước — cho người bệnh, cho gia đình, và cho đội ngũ đang chăm sóc.
                </p>
              </div>
              <button
                type="button"
                onClick={() => openLogin('staff')}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3.5 text-[13px] font-semibold text-white backdrop-blur transition hover:border-cyan-400/40 hover:bg-cyan-500/10"
              >
                <LogIn className="h-4 w-4 text-cyan-300" />
                Đăng nhập cổng nhân sự
              </button>
            </div>
            <div className="mx-auto flex max-w-6xl items-center justify-between border-t border-white/10 px-5 py-5 text-[11px] font-medium text-slate-500 sm:px-8">
              <p>© {new Date().getFullYear()} Bệnh viện KLTN</p>
              <p className="tracking-[0.18em] uppercase">01 — Home</p>
            </div>
          </section>
        </main>
      </div>

      {showLogin && (
        <LoginPage isModal initialMode={initialMode} onClose={closeLogin} />
      )}
    </div>
  );
}

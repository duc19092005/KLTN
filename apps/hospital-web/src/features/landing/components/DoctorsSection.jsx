import React from 'react';
import Reveal from './Reveal';
import { Calendar, ArrowRight, Award, Sparkles } from 'lucide-react';

const DOCTORS_HUMAN = [
  {
    name: 'GS. BS. Nguyễn Văn An',
    role: 'Trưởng khoa Tim mạch',
    experience: '25 năm kinh nghiệm',
    bio: 'Chuyên gia đầu ngành về thăm khám và điều trị tim mạch, tận tâm chăm sóc sức khỏe cho hàng ngàn bệnh nhân.',
    image: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'TS. BS. Trần Thị Bình',
    role: 'Chuyên gia Sản Phụ khoa',
    experience: '18 năm kinh nghiệm',
    bio: 'Đồng hành cùng mẹ và bé trong thai kỳ an toàn, chu đáo và nhẹ nhàng.',
    image: 'https://images.unsplash.com/photo-1594824813566-88855779663d?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'BSCKII. Lê Văn Cường',
    role: 'Chuyên khoa Cơ Xương Khớp',
    experience: '20 năm kinh nghiệm',
    bio: 'Điều trị chuyên sâu bệnh lý khớp và phục hồi vận động linh hoạt cho người tuổi trung niên.',
    image: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'PGS. TS. Phạm Thu Dung',
    role: 'Chuyên khoa Nhi',
    experience: '22 năm kinh nghiệm',
    bio: 'Yêu thương và thấu hiểu tâm lý trẻ nhỏ, tư vấn dinh dưỡng và chăm sóc toàn diện cho bé.',
    image: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=600&q=80'
  }
];

export default function DoctorsSection() {
  return (
    <section id="doi-ngu" className="bg-white py-20 border-t border-slate-100 antialiased" aria-labelledby="doctors-heading">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <Reveal variant="up" className="mb-12 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-sky-700 mb-3 border border-sky-100">
              <Sparkles className="w-3.5 h-3.5 text-sky-600" />
              <span>Đội Ngu Y Bác Sĩ Tận Tâm</span>
            </span>
            <h2 id="doctors-heading" className="text-3xl font-extrabold text-slate-900 sm:text-4xl tracking-tight">
              Hội đồng Chuyên gia Giàu Kinh nghiệm
            </h2>
          </div>
          <a
            href="#dat-lich"
            className="inline-flex items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-5 py-2.5 text-xs font-bold text-sky-700 hover:bg-sky-600 hover:text-white transition-all shadow-xs"
          >
            <span>Đăng ký tư vấn trực tiếp</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </Reveal>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {DOCTORS_HUMAN.map((doctor, index) => (
            <Reveal key={doctor.name} variant="up" delay={index * 80}>
              <article className="group overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm hover:shadow-xl transition-all duration-300">
                <div className="relative mb-4 aspect-[4/5] overflow-hidden rounded-2xl bg-slate-100">
                  <img
                    src={doctor.image}
                    alt={`Chân dung ${doctor.name}`}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    width={400}
                    height={500}
                    loading="lazy"
                  />
                  <div className="absolute top-3 left-3 rounded-full bg-white/95 backdrop-blur-xs px-3 py-1 text-[11px] font-bold text-slate-800 shadow-xs border border-slate-200">
                    {doctor.experience}
                  </div>
                </div>

                <div className="px-1">
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-sky-600 transition-colors">{doctor.name}</h3>
                  <p className="mt-0.5 text-xs font-bold uppercase tracking-wider text-sky-600">
                    {doctor.role}
                  </p>
                  <p className="mt-2 text-xs text-slate-500 font-medium leading-relaxed line-clamp-2">
                    {doctor.bio}
                  </p>

                  <a
                    href="#dat-lich"
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-50 py-2.5 text-xs font-bold text-slate-700 hover:bg-sky-600 hover:text-white transition-all"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>Đặt lịch khám</span>
                  </a>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

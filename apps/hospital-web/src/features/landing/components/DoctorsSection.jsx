import React from 'react';
import Reveal from './Reveal';
import { CalendarCheck, ArrowRight, Award, Sparkles, Stethoscope, CheckCircle2 } from 'lucide-react';

const DOCTORS_HUMAN = [
  {
    name: 'GS. BS. Nguyễn Văn An',
    role: 'Trưởng khoa Tim mạch',
    experience: '25 năm kinh nghiệm',
    bio: 'Chuyên gia đầu ngành về can thiệp tim mạch, thăm khám và điều trị hiệu quả các bệnh lý tim mạch phức tạp.',
    image: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'TS. BS. Trần Thị Bình',
    role: 'Chuyên gia Sản Phụ khoa',
    experience: '18 năm kinh nghiệm',
    bio: 'Chăm sóc chu đáo, nhẹ nhàng cho mẹ và bé trong thai kỳ an toàn, tư vấn sản phụ khoa toàn diện.',
    image: 'https://images.unsplash.com/photo-1594824813566-88855779663d?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'BSCKII. Lê Văn Cường',
    role: 'Chuyên khoa Cơ Xương Khớp',
    experience: '20 năm kinh nghiệm',
    bio: 'Chuyên phẫu thuật nội soi khớp và điều trị phục hồi vận động linh hoạt cho bệnh nhân xương khớp.',
    image: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'PGS. TS. Phạm Thu Dung',
    role: 'Chuyên khoa Ung Bướu & Nhi',
    experience: '22 năm kinh nghiệm',
    bio: 'Phác đồ điều trị cá thể hóa chuẩn quốc tế, tận tâm tư vấn và đồng hành cùng sức khỏe gia đình.',
    image: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=600&q=80'
  }
];

export default function DoctorsSection() {
  return (
    <section id="doi-ngu" className="bg-white py-24 border-t border-slate-200/60 antialiased" aria-labelledby="doctors-heading">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-8">
        <Reveal variant="up" className="mb-16 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-sky-100/80 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-sky-800 mb-3 border border-sky-200">
              <Sparkles className="w-3.5 h-3.5 text-sky-600" />
              <span>Đội Ngũ Y Bác Sĩ Đầu Ngành</span>
            </span>
            <h2 id="doctors-heading" className="text-3xl font-black text-slate-900 sm:text-4xl tracking-tight">
              Hội Đồng Bác Sĩ Chuyên Gia JCI
            </h2>
            <p className="mt-2 text-sm text-slate-600 max-w-xl font-medium leading-relaxed">
              Quy tụ đội ngũ Giáo sư, Tiến sĩ, Bác sĩ Chuyên khoa II giàu kinh nghiệm, luôn tận tâm đồng hành cùng sức khỏe quý bệnh nhân.
            </p>
          </div>
          <a
            href="#lien-he"
            className="inline-flex items-center gap-2.5 rounded-2xl bg-sky-600 px-6 py-3.5 text-xs font-black uppercase tracking-wider text-white shadow-md hover:bg-sky-700 transition-all hover:scale-[1.02]"
          >
            <Stethoscope className="w-4.5 h-4.5" />
            <span>Đăng ký hẹn khám ngay</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </Reveal>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {DOCTORS_HUMAN.map((doctor, index) => (
            <Reveal key={doctor.name} variant="up" delay={index * 80}>
              <article className="group flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm hover:border-sky-300 hover:shadow-2xl transition-all duration-300">
                <div>
                  <div className="relative mb-5 aspect-[4/5] overflow-hidden rounded-2xl bg-slate-100 border-2 border-white ring-2 ring-sky-100 shadow-md">
                    <img
                      src={doctor.image}
                      alt={`Chân dung ${doctor.name}`}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      width={400}
                      height={500}
                      loading="lazy"
                    />
                    <div className="absolute top-3 left-3 rounded-full bg-white/95 backdrop-blur-xs px-3.5 py-1 text-[11px] font-black text-slate-800 shadow-sm border border-slate-200 flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-sky-600" />
                      <span>{doctor.experience}</span>
                    </div>
                  </div>

                  <div className="px-1 space-y-1.5">
                    <h3 className="text-lg font-black text-slate-900 group-hover:text-sky-600 transition-colors">{doctor.name}</h3>
                    <div className="inline-block rounded-md bg-sky-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-sky-700 border border-sky-100">
                      {doctor.role}
                    </div>
                    <p className="pt-1 text-xs text-slate-500 font-medium leading-relaxed line-clamp-3">
                      {doctor.bio}
                    </p>
                  </div>
                </div>

                <div className="pt-5 px-1">
                  <a
                    href="#lien-he"
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-50 py-3 text-xs font-black uppercase tracking-wider text-sky-700 hover:bg-sky-600 hover:text-white transition-all shadow-xs"
                  >
                    <CalendarCheck className="w-4 h-4 text-sky-600 group-hover:text-white" />
                    <span>Đặt lịch thăm khám</span>
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

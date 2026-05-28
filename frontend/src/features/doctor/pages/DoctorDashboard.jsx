import React, { useEffect, useState } from 'react';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { doctorVisitService } from '../apis/doctorVisitService';

const STATUS = {
  WAITING: { label: 'Chờ khám', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  IN_PROGRESS: { label: 'Đang khám', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  WAITING_TEST_RESULT: { label: 'Chờ kết quả XN', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  WAITING_CONCLUSION: { label: 'Chờ kết luận', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  COMPLETED: { label: 'Hoàn tất', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  CANCELLED: { label: 'Đã hủy', color: 'bg-slate-100 text-slate-700 border-slate-200' },
};

const NEXT_ACTIONS = {
  WAITING: [{ status: 'IN_PROGRESS', label: 'Bắt đầu khám', tone: 'indigo' }],
  IN_PROGRESS: [
    { status: 'WAITING_TEST_RESULT', label: 'Chỉ định xét nghiệm', tone: 'purple' },
    { status: 'WAITING_CONCLUSION', label: 'Chờ kết luận', tone: 'blue' },
    { status: 'COMPLETED', label: 'Hoàn tất khám', tone: 'emerald' },
  ],
  WAITING_TEST_RESULT: [{ status: 'WAITING_CONCLUSION', label: 'Đã có kết quả', tone: 'indigo' }],
  WAITING_CONCLUSION: [{ status: 'COMPLETED', label: 'Hoàn tất', tone: 'emerald' }],
};

function actionClass(tone) {
  const map = {
    indigo: 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100',
    purple: 'bg-purple-600 hover:bg-purple-700 shadow-purple-100',
    blue: 'bg-blue-600 hover:bg-blue-700 shadow-blue-100',
    emerald: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100',
  };
  return map[tone] || map.indigo;
}

export default function DoctorDashboard() {
  const [visits, setVisits] = useState([]);
  const [activeVisit, setActiveVisit] = useState(null);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState('');
  const [filter, setFilter] = useState('WAITING');
  const [error, setError] = useState('');

  const loadVisits = async () => {
    setLoading(true); setError('');
    try {
      const params = filter ? { status: filter, limit: 30 } : { limit: 30 };
      const res = await doctorVisitService.list(params);
      const items = res.data?.items || (Array.isArray(res.data) ? res.data : []);
      setVisits(items);
      if (activeVisit) {
        const updated = items.find((v) => v.id === activeVisit.id);
        if (updated) setActiveVisit(updated);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Không tải được danh sách lượt khám');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadVisits(); }, [filter]);

  const updateStatus = async (visit, status) => {
    setUpdatingId(visit.id); setError('');
    try {
      const res = await doctorVisitService.updateStatus(visit.id, status);
      setActiveVisit(res.data);
      await loadVisits();
    } catch (err) {
      setError(err.response?.data?.message || 'Không cập nhật được trạng thái');
    } finally {
      setUpdatingId('');
    }
  };

  const stats = {
    waiting: visits.filter((v) => v.status === 'WAITING').length,
    inProgress: visits.filter((v) => v.status === 'IN_PROGRESS').length,
    done: visits.filter((v) => v.status === 'COMPLETED').length,
  };

  return (
    <div className="min-h-screen bg-[#F4F7FA] p-4 sm:p-6 lg:p-8 text-slate-900 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="relative overflow-hidden rounded-3xl bg-slate-950 text-white p-7 shadow-2xl shadow-indigo-200">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.55),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.28),transparent_40%)]" />
          <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-indigo-200 font-black">Clinical Workspace</p>
              <h1 className="text-3xl font-black mt-2 tracking-tight">Dashboard Bác sĩ</h1>
              <p className="text-sm text-slate-300 mt-2 max-w-2xl">Tiếp nhận hàng đợi, bắt đầu lượt khám, chỉ định xét nghiệm và hoàn tất quy trình lâm sàng.</p>
            </div>
            <div className="grid grid-cols-3 gap-3 min-w-[320px]">
              <Stat label="Chờ khám" value={stats.waiting} />
              <Stat label="Đang khám" value={stats.inProgress} />
              <Stat label="Hoàn tất" value={stats.done} />
            </div>
          </div>
        </header>

        {error && <div className="rounded-xl bg-red-50 border border-red-100 p-4 text-sm font-bold text-red-700">{error}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <aside className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="font-black text-slate-900">Danh sách lượt khám</h2>
                <p className="text-xs text-slate-500">Chọn một bệnh nhân để xem chi tiết.</p>
              </div>
              <button onClick={loadVisits} className="w-9 h-9 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white">{loading ? <LoadingIndicator size="sm" /> : '↻'}</button>
            </div>
            <div className="p-4 border-b border-slate-100 flex gap-2 overflow-x-auto">
              {['WAITING', 'IN_PROGRESS', 'WAITING_TEST_RESULT', 'WAITING_CONCLUSION', 'COMPLETED', ''].map((s) => (
                <button key={s || 'ALL'} onClick={() => setFilter(s)} className={`px-3 py-2 rounded-xl text-xs font-black border whitespace-nowrap ${filter === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>{s ? STATUS[s]?.label : 'Tất cả'}</button>
              ))}
            </div>
            <div className="p-4 space-y-3 max-h-[620px] overflow-y-auto">
              {visits.length === 0 && !loading && <div className="py-12 text-center text-sm text-slate-400">Không có lượt khám phù hợp.</div>}
              {visits.map((visit) => <VisitCard key={visit.id} visit={visit} active={activeVisit?.id === visit.id} onClick={() => setActiveVisit(visit)} />)}
            </div>
          </aside>

          <main className="lg:col-span-7">
            {!activeVisit ? <EmptyDetail /> : (
              <VisitDetail visit={activeVisit} updating={updatingId === activeVisit.id} onStatus={(status) => updateStatus(activeVisit, status)} />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) { return <div className="rounded-2xl bg-white/10 border border-white/10 p-4 backdrop-blur"><p className="text-[10px] uppercase tracking-wider text-slate-300 font-bold">{label}</p><p className="text-2xl font-black mt-1">{value}</p></div>; }
function VisitCard({ visit, active, onClick }) { const st = STATUS[visit.status] || STATUS.WAITING; return <button onClick={onClick} className={`w-full text-left rounded-2xl border p-4 transition-all ${active ? 'border-indigo-400 bg-indigo-50 shadow-indigo-100 shadow-md' : 'border-slate-100 bg-white hover:border-indigo-200 hover:shadow-md'}`}><div className="flex justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{visit.visitCode}</p><h3 className="font-black text-slate-900 mt-1">{visit.patient?.fullName}</h3><p className="text-xs text-slate-500 mt-1">{visit.patient?.patientCode} · {visit.patient?.phone || 'Chưa có SĐT'}</p></div><span className={`h-fit text-[10px] font-black px-2 py-1 rounded-full border ${st.color}`}>{st.label}</span></div><div className="mt-3 rounded-xl bg-slate-50 border border-slate-100 p-3"><p className="text-xs font-bold text-slate-700">{visit.clinicalRoom?.roomName}</p><p className="text-[11px] text-slate-500 mt-0.5">{visit.symptoms || 'Chưa ghi triệu chứng'}</p></div></button>; }
function EmptyDetail() { return <div className="min-h-[520px] rounded-2xl border border-dashed border-slate-300 bg-white/70 flex flex-col items-center justify-center text-center p-8"><div className="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-3xl mb-4">🩺</div><h2 className="font-black text-slate-900">Chọn lượt khám</h2><p className="text-sm text-slate-500 mt-2 max-w-sm">Thông tin bệnh nhân, phòng khám và thao tác cập nhật trạng thái sẽ hiển thị tại đây.</p></div>; }
function VisitDetail({ visit, updating, onStatus }) { const st = STATUS[visit.status] || STATUS.WAITING; const actions = NEXT_ACTIONS[visit.status] || []; return <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden"><div className="p-6 border-b border-slate-100 bg-gradient-to-br from-indigo-50 to-white"><div className="flex justify-between gap-4"><div><p className="text-[11px] uppercase tracking-[0.22em] text-indigo-500 font-black">{visit.visitCode}</p><h2 className="text-2xl font-black text-slate-900 mt-1">{visit.patient?.fullName}</h2><p className="text-sm text-slate-500 mt-1">{visit.patient?.patientCode} · CCCD: {visit.patient?.citizenId || 'N/A'}</p></div><span className={`h-fit text-xs font-black px-3 py-1.5 rounded-full border ${st.color}`}>{st.label}</span></div></div><div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4"><Info label="Ngày sinh" value={visit.patient?.birthDate ? new Date(visit.patient.birthDate).toLocaleDateString('vi-VN') : 'N/A'} /><Info label="Số điện thoại" value={visit.patient?.phone || 'N/A'} /><Info label="Phòng khám" value={`${visit.clinicalRoom?.roomName || ''} (${visit.clinicalRoom?.roomCode || ''})`} /><Info label="Bác sĩ" value={`BS. ${visit.doctor?.staffProfile?.fullName || 'N/A'}`} /><div className="md:col-span-2"><Info label="Triệu chứng" value={visit.symptoms || 'Chưa ghi nhận'} /></div></div><div className="p-6 border-t border-slate-100 bg-slate-50 flex flex-wrap gap-3">{actions.length === 0 ? <p className="text-sm text-slate-500 font-bold">Không còn thao tác tiếp theo cho trạng thái này.</p> : actions.map((a) => <button key={a.status} disabled={updating} onClick={() => onStatus(a.status)} className={`px-4 py-3 rounded-xl text-white text-sm font-black shadow-lg disabled:opacity-60 ${actionClass(a.tone)}`}>{updating ? 'Đang cập nhật...' : a.label}</button>)}</div></div>; }
function Info({ label, value }) { return <div className="rounded-xl border border-slate-100 bg-slate-50 p-4"><p className="text-[10px] uppercase tracking-wider text-slate-400 font-black mb-1">{label}</p><p className="text-sm font-bold text-slate-800">{value}</p></div>; }

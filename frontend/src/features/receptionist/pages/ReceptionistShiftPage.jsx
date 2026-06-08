import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { usePreferences } from '../../../providers/PreferencesProvider';
import { useToast } from '../../../providers/ToastProvider';
import { RECEPTIONIST_NAV_ITEMS, receptionistRouteFor } from '../constants/navigation';
import { receptionShiftService } from '../apis/receptionShiftService';

const SHIFT_WINDOWS = {
  A: { label: 'Ca A', time: '07:00 - 12:00', tone: 'border-amber-200 bg-amber-50 text-amber-900' },
  B: { label: 'Ca B', time: '13:00 - 17:00', tone: 'border-cyan-200 bg-cyan-50 text-cyan-900' },
};
const STATUS_META = {
  PENDING: { label: 'Chờ duyệt', dot: 'bg-amber-400', bg: 'bg-amber-50 border-amber-200 text-amber-800' },
  APPROVED: { label: 'Đã duyệt', dot: 'bg-emerald-500', bg: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  REJECTED: { label: 'Từ chối', dot: 'bg-red-400', bg: 'bg-red-50 border-red-200 text-red-700' },
};
const DOW = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function monthDays(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const days = [];
  const startDow = (first.getDay() + 6) % 7;
  for (let i = startDow - 1; i >= 0; i -= 1) days.push({ date: new Date(year, month, -i), other: true });
  for (let d = 1; d <= last.getDate(); d += 1) days.push({ date: new Date(year, month, d), other: false });
  while (days.length % 7) days.push({ date: new Date(year, month + 1, days.length), other: true });
  return days;
}

export default function ReceptionistShiftPage() {
  const { user, logout } = useAuth();
  const { prefs } = usePreferences();
  const toast = useToast();
  const navigate = useNavigate();
  const demoMode = Boolean(prefs.demoMode);
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [departments, setDepartments] = useState([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [myShifts, setMyShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const days = useMemo(() => monthDays(year, month), [year, month]);
  const shiftsBySlot = useMemo(() => {
    const map = {};
    for (const shift of myShifts) {
      const key = `${toDateKey(new Date(shift.workDate || shift.startTime))}:${shift.shiftCode}`;
      map[key] = shift;
    }
    return map;
  }, [myShifts]);

  async function loadData() {
    setLoading(true);
    try {
      const from = `${toDateKey(days[0].date)}T00:00:00`;
      const to = `${toDateKey(days[days.length - 1].date)}T23:59:59`;
      const [depsRes, shiftsRes] = await Promise.all([
        receptionShiftService.availableDepartments(),
        receptionShiftService.myShifts(from, to),
      ]);
      const deps = Array.isArray(depsRes.data) ? depsRes.data : [];
      setDepartments(deps);
      if (!selectedDepartmentId && deps[0]) setSelectedDepartmentId(deps[0].id);
      setMyShifts(Array.isArray(shiftsRes.data) ? shiftsRes.data : []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không tải được lịch làm việc lễ tân.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [year, month]);

  async function submitRegister(e) {
    e.preventDefault();
    try {
      await receptionShiftService.register(modal.departmentId, modal.workDate, modal.shiftCode, modal.note, demoMode);
      toast.success(demoMode ? 'Demo mode: ca làm đã được tự duyệt.' : 'Đã gửi đăng ký ca làm, chờ quản lý duyệt.');
      setModal(null);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Đăng ký ca làm thất bại.');
    }
  }

  const openModal = (workDate, shiftCode) => setModal({ departmentId: selectedDepartmentId || departments[0]?.id || '', workDate, shiftCode, note: '' });
  const prevMonth = () => month === 0 ? (setYear((y) => y - 1), setMonth(11)) : setMonth((m) => m - 1);
  const nextMonth = () => month === 11 ? (setYear((y) => y + 1), setMonth(0)) : setMonth((m) => m + 1);

  return (
    <DashboardLayout user={user} navItems={RECEPTIONIST_NAV_ITEMS} activeItem="shifts" onNavigate={(id) => navigate(receptionistRouteFor(id))} onLogout={logout}>
      <div className="mx-auto max-w-7xl space-y-5 pb-12">
        <section className="relative overflow-hidden rounded-[2rem] border border-sky-100 bg-gradient-to-br from-slate-950 via-sky-950 to-cyan-900 p-6 text-white shadow-2xl shadow-sky-950/20">
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-cyan-300/20 blur-3xl" />
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200">Lễ tân · Ca làm việc chuẩn</p>
          <h1 className="mt-2 text-3xl font-black">Đăng ký Ca A / Ca B</h1>
          <p className="mt-2 max-w-2xl text-sm font-semibold text-cyan-50/80">Lễ tân đăng ký ca theo ngày. Quản lý duyệt trước khi ca có hiệu lực cho vận hành quầy tiếp nhận.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {Object.entries(SHIFT_WINDOWS).map(([code, shift]) => <div key={code} className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur"><p className="text-xs font-black">{shift.label}</p><p className="text-2xl font-black text-cyan-100">{shift.time}</p></div>)}
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={prevMonth} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600">←</button>
            <span className="rounded-xl bg-cyan-50 px-4 py-2 text-xs font-black text-cyan-700">Tháng {month + 1}/{year}</span>
            <button onClick={nextMonth} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600">→</button>
            <select value={selectedDepartmentId} onChange={(e) => setSelectedDepartmentId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700">
              {departments.map((dep) => <option key={dep.id} value={dep.id}>{dep.departmentCode} · {dep.name}</option>)}
            </select>
          </div>
          <button onClick={() => openModal(toDateKey(today), 'A')} className="rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-cyan-600/20">+ Đăng ký ca</button>
        </section>

        {loading ? <LoadingIndicator size="lg" label="Đang tải lịch làm việc..." /> : (
          <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
            <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">{DOW.map((d) => <div key={d} className="py-3 text-center text-[11px] font-black text-slate-400">{d}</div>)}</div>
            <div className="grid grid-cols-7">
              {days.map((day, idx) => {
                const dateKey = toDateKey(day.date);
                const isPast = !demoMode && dateKey < toDateKey(today);
                return <div key={idx} className={`min-h-[150px] border-b border-r border-slate-100 p-2 ${day.other ? 'bg-slate-50/70 text-slate-300' : 'bg-white'}`}>
                  <p className="mb-2 text-xs font-black text-slate-600">{day.date.getDate()}</p>
                  <div className="space-y-2">
                    {Object.entries(SHIFT_WINDOWS).map(([code, shift]) => {
                      const registered = shiftsBySlot[`${dateKey}:${code}`];
                      const status = registered ? STATUS_META[registered.status] : null;
                      return <button key={code} disabled={day.other || isPast || Boolean(registered)} onClick={() => openModal(dateKey, code)} className={`w-full rounded-2xl border p-2 text-left transition ${registered ? status.bg : shift.tone} ${day.other || isPast ? 'opacity-50' : 'hover:-translate-y-0.5 hover:shadow-md'}`}>
                        <div className="flex items-center justify-between"><span className="text-[11px] font-black">{shift.label}</span><span className="text-[9px] font-bold opacity-70">{shift.time}</span></div>
                        <p className="mt-1 text-[10px] font-bold opacity-70">{registered ? status.label : 'Chưa đăng ký'}</p>
                      </button>;
                    })}
                  </div>
                </div>;
              })}
            </div>
          </section>
        )}

        {modal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-md">
          <form onSubmit={submitRegister} className="w-full max-w-lg overflow-hidden rounded-[2rem] bg-white shadow-2xl">
            <div className="bg-gradient-to-r from-cyan-600 to-blue-700 p-6 text-white"><h3 className="text-xl font-black">Đăng ký ca làm lễ tân</h3><p className="mt-1 text-xs font-semibold text-cyan-50">Chọn ngày và Ca A/B, không nhập giờ thủ công.</p></div>
            <div className="space-y-4 p-5">
              <select value={modal.departmentId} onChange={(e) => setModal({ ...modal, departmentId: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm font-bold" required>{departments.map((dep) => <option key={dep.id} value={dep.id}>{dep.departmentCode} · {dep.name}</option>)}</select>
              <div className="grid gap-3 sm:grid-cols-2"><input type="date" value={modal.workDate} onChange={(e) => setModal({ ...modal, workDate: e.target.value })} className="rounded-xl border border-slate-200 px-3 py-3 text-sm font-bold" required /><select value={modal.shiftCode} onChange={(e) => setModal({ ...modal, shiftCode: e.target.value })} className="rounded-xl border border-slate-200 px-3 py-3 text-sm font-bold">{Object.entries(SHIFT_WINDOWS).map(([code, shift]) => <option key={code} value={code}>{shift.label} · {shift.time}</option>)}</select></div>
              <textarea value={modal.note} onChange={(e) => setModal({ ...modal, note: e.target.value })} placeholder="Ghi chú ca làm..." rows={3} maxLength={500} className="w-full resize-none rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold" />
              <div className="flex gap-2"><button type="button" onClick={() => setModal(null)} className="flex-1 rounded-xl border border-slate-200 py-3 text-xs font-black text-slate-600">Hủy</button><button type="submit" className="flex-1 rounded-xl bg-cyan-600 py-3 text-xs font-black text-white">Gửi đăng ký</button></div>
            </div>
          </form>
        </div>}
      </div>
    </DashboardLayout>
  );
}

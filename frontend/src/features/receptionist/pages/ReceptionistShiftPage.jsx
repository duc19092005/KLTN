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
  A: { label: 'Ca A', time: '07:00 - 12:00', tone: 'border-slate-200 bg-slate-50 text-slate-800' },
  B: { label: 'Ca B', time: '13:00 - 17:00', tone: 'border-slate-200 bg-slate-50 text-slate-800' },
};
const STATUS_META = {
  PENDING: { label: 'Chờ duyệt', dot: 'bg-amber-400', bg: 'bg-amber-50 border-amber-200 text-amber-800' },
  APPROVED: { label: 'Đã duyệt', dot: 'bg-emerald-500', bg: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  REJECTED: { label: 'Từ chối', dot: 'bg-rose-400', bg: 'bg-rose-50 border-rose-200 text-rose-700' },
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
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [submitting, setSubmitting] = useState(false);
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
    const slots = selectedSlots.length > 0 ? selectedSlots : [{ workDate: modal.workDate, shiftCode: modal.shiftCode }];
    const payload = slots.map((slot) => ({
      departmentId: modal.departmentId,
      workDate: slot.workDate,
      shiftCode: slot.shiftCode,
      note: modal.note,
    }));
    setSubmitting(true);
    try {
      await receptionShiftService.registerMany(payload, demoMode);
      toast.success(demoMode ? `Demo mode: đã đăng ký và tự duyệt ${payload.length} ca.` : `Đã gửi ${payload.length} đăng ký ca làm, chờ quản lý duyệt.`);
      setSelectedSlots([]);
      setModal(null);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Đăng ký ca làm thất bại.');
    } finally {
      setSubmitting(false);
    }
  }

  const toggleSlot = (workDate, shiftCode) => {
    setSelectedSlots((current) => {
      const exists = current.some((slot) => slot.workDate === workDate && slot.shiftCode === shiftCode);
      if (exists) return current.filter((slot) => !(slot.workDate === workDate && slot.shiftCode === shiftCode));
      return [...current, { workDate, shiftCode }].sort((a, b) => `${a.workDate}:${a.shiftCode}`.localeCompare(`${b.workDate}:${b.shiftCode}`));
    });
  };

  const openBulkModal = () => {
    if (selectedSlots.length === 0) {
      toast.error('Vui lòng chọn ít nhất một ca trên lịch.');
      return;
    }
    const first = selectedSlots[0];
    setModal({ departmentId: selectedDepartmentId || departments[0]?.id || '', workDate: first.workDate, shiftCode: first.shiftCode, note: '' });
  };

  const openModal = (workDate, shiftCode) => setModal({ departmentId: selectedDepartmentId || departments[0]?.id || '', workDate, shiftCode, note: '' });
  const prevMonth = () => month === 0 ? (setYear((y) => y - 1), setMonth(11)) : setMonth((m) => m - 1);
  const nextMonth = () => month === 11 ? (setYear((y) => y + 1), setMonth(0)) : setMonth((m) => m + 1);

  return (
    <DashboardLayout user={user} navItems={RECEPTIONIST_NAV_ITEMS} activeItem="shifts" onNavigate={(id) => navigate(receptionistRouteFor(id))} onLogout={logout}>
      <div className="mx-auto max-w-7xl space-y-5 pb-12">
        <section className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={prevMonth} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600">←</button>
            <span className="rounded-xl bg-cyan-50 px-4 py-2 text-xs font-black text-cyan-700">Tháng {month + 1}/{year}</span>
            <button onClick={nextMonth} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600">→</button>
            <select value={selectedDepartmentId} onChange={(e) => setSelectedDepartmentId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700">
              {departments.map((dep) => <option key={dep.id} value={dep.id}>{dep.departmentCode} · {dep.name}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={openBulkModal} disabled={selectedSlots.length === 0} className="rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-black text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50">Gửi {selectedSlots.length || ''} ca đã chọn</button>
            <button onClick={() => setSelectedSlots([])} disabled={selectedSlots.length === 0} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black text-slate-600 disabled:cursor-not-allowed disabled:opacity-50">Bỏ chọn</button>
          </div>
        </section>

        {loading ? <LoadingIndicator size="lg" label="Đang tải lịch làm việc..." /> : (
          <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
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
                      const isSelected = selectedSlots.some((slot) => slot.workDate === dateKey && slot.shiftCode === code);
                      const disabled = day.other || isPast || Boolean(registered);
                      return <button key={code} disabled={disabled} onClick={() => toggleSlot(dateKey, code)} className={`w-full rounded-xl border p-2 text-left transition-colors ${registered ? status.bg : isSelected ? 'border-cyan-400 bg-cyan-50 text-cyan-900 shadow-sm ring-2 ring-cyan-200' : shift.tone} ${disabled ? 'cursor-not-allowed opacity-50' : ' hover:border-cyan-200 hover:bg-cyan-50/60'}`}>
                        <div className="flex items-center justify-between"><span className="text-[11px] font-black">{shift.label}</span><span className="text-[9px] font-bold opacity-70">{shift.time}</span></div>
                        <p className="mt-1 text-[10px] font-bold opacity-70">{registered ? status.label : isSelected ? 'Đã chọn' : 'Chưa đăng ký'}</p>
                      </button>;
                    })}
                  </div>
                </div>;
              })}
            </div>
          </section>
        )}

        {modal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-md">
          <form onSubmit={submitRegister} className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 p-6 text-white"><h3 className="text-xl font-black">Đăng ký ca làm lễ tân</h3><p className="mt-1 text-xs font-semibold text-cyan-50">Chọn ngày và Ca A/B, không nhập giờ thủ công.</p></div>
            <div className="space-y-4 p-5">
              <select value={modal.departmentId} onChange={(e) => setModal({ ...modal, departmentId: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm font-bold" required>{departments.map((dep) => <option key={dep.id} value={dep.id}>{dep.departmentCode} · {dep.name}</option>)}</select>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                <div className="mb-2 flex items-center justify-between"><p className="text-[11px] font-black uppercase tracking-wider text-slate-600">Ca đã chọn</p><span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-black text-cyan-700">{(selectedSlots.length || 1)} ca</span></div>
                <div className="grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2">
                  {(selectedSlots.length > 0 ? selectedSlots : [{ workDate: modal.workDate, shiftCode: modal.shiftCode }]).map((slot) => {
                    const meta = SHIFT_WINDOWS[slot.shiftCode];
                    return <div key={`${slot.workDate}:${slot.shiftCode}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-800"><p className="text-xs font-black">{new Date(slot.workDate).toLocaleDateString('vi-VN')}</p><p className="mt-0.5 text-[11px] font-bold">{meta.label} · {meta.time}</p></div>;
                  })}
                </div>
              </div>
              <textarea value={modal.note} onChange={(e) => setModal({ ...modal, note: e.target.value })} placeholder="Ghi chú ca làm..." rows={3} maxLength={500} className="w-full resize-none rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold" />
              <div className="flex gap-2"><button type="button" disabled={submitting} onClick={() => setModal(null)} className="flex-1 rounded-xl border border-slate-200 py-3 text-xs font-black text-slate-600 disabled:opacity-50">Hủy</button><button type="submit" disabled={submitting} className="flex-1 rounded-xl bg-cyan-600 py-3 text-xs font-black text-white disabled:opacity-60">{submitting ? 'Đang gửi...' : `Gửi ${selectedSlots.length || 1} đăng ký`}</button></div>
            </div>
          </form>
        </div>}
      </div>
    </DashboardLayout>
  );
}

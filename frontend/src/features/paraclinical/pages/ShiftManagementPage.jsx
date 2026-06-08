import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { usePreferences } from '../../../providers/PreferencesProvider';
import { useToast } from '../../../providers/ToastProvider';
import { shiftService } from '../apis/paraclinicalService';
import { LAB_MANAGER_NAV_ITEMS, labManagerRouteFor } from '../../lab-manager/constants/navigation';

const SHIFT_WINDOWS = {
  A: { label: 'Ca A', time: '07:00 - 12:00', accent: 'from-amber-400 to-orange-500', soft: 'bg-amber-50 border-amber-200 text-amber-900' },
  B: { label: 'Ca B', time: '13:00 - 17:00', accent: 'from-cyan-500 to-blue-600', soft: 'bg-cyan-50 border-cyan-200 text-cyan-900' },
};

const STATUS_META = {
  PENDING: { label: 'Chờ duyệt', dot: 'bg-amber-400', bg: 'bg-amber-50 border-amber-200 text-amber-800' },
  APPROVED: { label: 'Đã duyệt', dot: 'bg-emerald-500', bg: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  REJECTED: { label: 'Từ chối', dot: 'bg-red-400', bg: 'bg-red-50 border-red-200 text-red-700' },
};

const DAYS_OF_WEEK = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function toLocalISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateLocal(d) {
  return d.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

function formatTimeLocal(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function getMonthDays(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days = [];
  const startDow = (firstDay.getDay() + 6) % 7;
  for (let i = startDow - 1; i >= 0; i -= 1) days.push({ date: new Date(year, month, -i), isOtherMonth: true });
  for (let d = 1; d <= lastDay.getDate(); d += 1) days.push({ date: new Date(year, month, d), isOtherMonth: false });
  const remaining = (7 - (days.length % 7)) % 7;
  for (let i = 1; i <= remaining; i += 1) days.push({ date: new Date(year, month + 1, i), isOtherMonth: true });
  return days;
}

export default function ShiftManagementPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { prefs } = usePreferences();
  const demoMode = prefs.demoMode || false;
  const today = new Date();

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registerForm, setRegisterForm] = useState({ roomId: '', workDate: toLocalISODate(today), shiftCode: 'A', note: '' });
  const [showHistory, setShowHistory] = useState(false);
  const [myShifts, setMyShifts] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const monthDays = useMemo(() => getMonthDays(year, month), [year, month]);
  const monthLabel = `Tháng ${month + 1}/${year}`;

  const shiftsByDateCode = useMemo(() => {
    const map = {};
    shifts.forEach((shift) => {
      const dateKey = toLocalISODate(new Date(shift.workDate || shift.startTime));
      const code = shift.shiftCode || (new Date(shift.startTime).getHours() < 12 ? 'A' : 'B');
      map[`${dateKey}:${code}`] = [...(map[`${dateKey}:${code}`] || []), shift];
    });
    return map;
  }, [shifts]);

  useEffect(() => {
    let mounted = true;
    async function loadRooms() {
      try {
        const res = await shiftService.availableRooms();
        const list = Array.isArray(res.data) ? res.data : [];
        if (!mounted) return;
        setRooms(list);
        if (!selectedRoomId && list.length > 0) setSelectedRoomId(list[0].id);
      } catch (err) {
        console.error('[ShiftManagement] Failed to load departments:', err);
        toast.error('Không tải được danh sách khoa phù hợp chuyên môn.');
      }
    }
    loadRooms();
    return () => { mounted = false; };
  }, []);

  const loadShifts = useCallback(async () => {
    setLoading(true);
    try {
      const from = toLocalISODate(monthDays[0]?.date);
      const to = toLocalISODate(monthDays[monthDays.length - 1]?.date);
      if (selectedRoomId && from && to) {
        const res = await shiftService.listByDepartment(selectedRoomId, `${from}T00:00:00`, `${to}T23:59:59`);
        setShifts(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      console.error('Failed to load shifts:', err);
      toast.error('Không tải được lịch trực.');
    } finally {
      setLoading(false);
    }
  }, [selectedRoomId, monthDays, toast]);

  const loadMyShifts = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const from = new Date();
      from.setFullYear(from.getFullYear() - 1);
      const to = new Date();
      to.setFullYear(to.getFullYear() + 1);
      const res = await shiftService.myShifts(from.toISOString(), to.toISOString());
      setMyShifts(Array.isArray(res.data) ? res.data : []);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { loadShifts(); }, [loadShifts]);
  useEffect(() => { if (showHistory) loadMyShifts(); }, [showHistory, loadMyShifts]);

  const openRegister = (workDate, shiftCode) => {
    setRegisterForm({ roomId: selectedRoomId || '', workDate, shiftCode, note: '' });
    setShowRegister(true);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegistering(true);
    try {
      await shiftService.register(registerForm.roomId, registerForm.workDate, registerForm.shiftCode, registerForm.note, demoMode);
      toast.success(demoMode ? 'Demo mode: ca trực đã được đăng ký và tự duyệt.' : 'Đã gửi đăng ký ca trực, chờ quản lý duyệt.');
      setShowRegister(false);
      await Promise.all([loadShifts(), loadMyShifts()]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Đăng ký thất bại');
    } finally {
      setRegistering(false);
    }
  };

  const prevMonth = () => { if (month === 0) { setYear((y) => y - 1); setMonth(11); } else setMonth((m) => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear((y) => y + 1); setMonth(0); } else setMonth((m) => m + 1); };
  const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); };

  return (
    <DashboardLayout user={user} navItems={LAB_MANAGER_NAV_ITEMS} activeItem="shifts" onNavigate={(id) => navigate(labManagerRouteFor(id))} onLogout={logout}>
      <div className="mx-auto max-w-7xl space-y-5 pb-12">
        <section className="relative overflow-hidden rounded-[2rem] border border-cyan-100 bg-gradient-to-br from-slate-950 via-cyan-950 to-blue-950 p-6 text-white shadow-2xl shadow-cyan-950/20">
          <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-32 w-32 rounded-full bg-blue-400/20 blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-200">Lịch trực cận lâm sàng · Ca chuẩn</p>
              <h1 className="mt-2 text-3xl font-black">Đăng ký Ca A / Ca B</h1>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-cyan-50/80">
                Nhân viên đăng ký ca theo ngày, quản lý duyệt trước khi ca có hiệu lực. Chỉ ca <b>Đã duyệt</b> mới được tính là đang trực để xử lý chỉ định.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(SHIFT_WINDOWS).map(([code, meta]) => (
                <div key={code} className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur">
                  <p className="text-xs font-black text-white">{meta.label}</p>
                  <p className="text-lg font-black text-cyan-100">{meta.time}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {rooms.length > 0 && (
                <select value={selectedRoomId} onChange={(e) => setSelectedRoomId(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100">
                  {rooms.map((room) => <option key={room.id} value={room.id}>{room.roomName || room.name}</option>)}
                </select>
              )}
              <button onClick={prevMonth} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">←</button>
              <button onClick={goToday} className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-700">{monthLabel}</button>
              <button onClick={nextMonth} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">→</button>
              <button onClick={goToday} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50">Hôm nay</button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => openRegister(toLocalISODate(today), 'A')} className="rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-cyan-600/20 hover:bg-cyan-700">+ Đăng ký ca</button>
              <button onClick={() => setShowHistory(true)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black text-slate-600 hover:bg-slate-50">Lịch sử đăng ký</button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-[10px] font-bold text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-amber-400" /> Chờ duyệt</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-emerald-500" /> Đã duyệt</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-red-400" /> Từ chối</span>
            <span className="text-slate-400">Click vào Ca A/Ca B trong ngày để đăng ký nhanh.</span>
          </div>
        </section>

        {loading ? <LoadingIndicator size="lg" label="Đang tải lịch trực..." /> : (
          <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
            <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/80">
              {DAYS_OF_WEEK.map((day) => <div key={day} className="py-3 text-center text-[11px] font-black uppercase text-slate-400">{day}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {monthDays.map((day, idx) => {
                const dateStr = toLocalISODate(day.date);
                const isToday = dateStr === toLocalISODate(today);
                const isPast = !demoMode && dateStr < toLocalISODate(today);
                return (
                  <div key={idx} className={`min-h-[168px] border-b border-r border-slate-100 p-2 ${day.isOtherMonth ? 'bg-slate-50/60 text-slate-300' : isToday ? 'bg-cyan-50/40' : 'bg-white'}`}>
                    <div className="mb-2 flex items-center justify-between">
                      <span className={`text-xs font-black ${isToday ? 'text-cyan-700' : 'text-slate-600'}`}>{day.date.getDate()}</span>
                      {isToday && <span className="rounded-full bg-cyan-600 px-2 py-0.5 text-[9px] font-black text-white">Hôm nay</span>}
                    </div>
                    <div className="space-y-2">
                      {Object.entries(SHIFT_WINDOWS).map(([code, meta]) => {
                        const slotShifts = shiftsByDateCode[`${dateStr}:${code}`] || [];
                        const disabled = day.isOtherMonth || isPast;
                        return (
                          <button key={code} type="button" disabled={disabled} onClick={() => openRegister(dateStr, code)} className={`w-full rounded-2xl border p-2 text-left transition-all ${disabled ? 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-60' : `${meta.soft} hover:-translate-y-0.5 hover:shadow-lg`}`}>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-black">{meta.label}</span>
                              <span className="text-[9px] font-bold opacity-70">{meta.time}</span>
                            </div>
                            <div className="mt-1 space-y-1">
                              {slotShifts.length === 0 ? <p className="text-[10px] font-semibold opacity-50">Chưa có đăng ký</p> : slotShifts.slice(0, 3).map((shift) => {
                                const status = STATUS_META[shift.status] || STATUS_META.PENDING;
                                return <p key={shift.id} className="truncate rounded-lg bg-white/70 px-2 py-1 text-[10px] font-bold"><span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${status.dot}`} />{shift.staff?.fullName || 'N/A'}</p>;
                              })}
                              {slotShifts.length > 3 && <p className="text-[10px] font-bold opacity-60">+{slotShifts.length - 3} nhân viên khác</p>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {showRegister && <RegisterModal form={registerForm} setForm={setRegisterForm} onSubmit={handleRegister} onClose={() => setShowRegister(false)} rooms={rooms} demoMode={demoMode} submitting={registering} />}
        {showHistory && <HistoryModal shifts={myShifts} loading={historyLoading} onClose={() => setShowHistory(false)} />}
      </div>
    </DashboardLayout>
  );
}

function RegisterModal({ form, setForm, onSubmit, onClose, rooms, demoMode, submitting }) {
  const today = new Date();
  const minDate = demoMode ? '2020-01-01' : toLocalISODate(today);
  const maxDate = demoMode ? '2030-12-31' : toLocalISODate(new Date(today.getFullYear(), today.getMonth() + 2, 0));
  const selectedShift = SHIFT_WINDOWS[form.shiftCode];
  const update = (patch) => setForm({ ...form, ...patch });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-md">
      <div className="w-full max-w-xl overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-2xl">
        <div className="bg-gradient-to-br from-cyan-600 via-blue-600 to-indigo-700 p-6 text-white">
          <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ring-1 ring-white/20">Đăng ký · Chờ duyệt</span>
          <h3 className="mt-3 text-xl font-black">Đăng ký ca trực chuẩn</h3>
          <p className="mt-1 text-xs font-semibold text-cyan-50">Chọn ngày và Ca A/Ca B. Hệ thống tự áp dụng giờ làm cố định.</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 p-5">
          <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-3 text-xs font-semibold text-amber-800">
            Ca gửi mới ở trạng thái <b>{demoMode ? 'Đã duyệt tự động do Demo Mode' : 'Chờ duyệt'}</b>. Chỉ ca đã duyệt mới được tính là đang trực.
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-slate-600">Khoa/phòng ban</label>
            <select value={form.roomId} onChange={(e) => update({ roomId: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-3 text-sm font-bold text-slate-700 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100" required>
              {rooms.map((room) => <option key={room.id} value={room.id}>{room.roomName || room.name}</option>)}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-slate-600">Ngày trực</label>
              <input type="date" value={form.workDate} min={minDate} max={maxDate} onChange={(e) => update({ workDate: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100" required />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-slate-600">Ca trực</label>
              <select value={form.shiftCode} onChange={(e) => update({ shiftCode: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-black outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100" required>
                {Object.entries(SHIFT_WINDOWS).map(([code, meta]) => <option key={code} value={code}>{meta.label} · {meta.time}</option>)}
              </select>
            </div>
          </div>
          <div className={`rounded-2xl border p-4 ${selectedShift.soft}`}>
            <p className="text-xs font-black">{selectedShift.label}</p>
            <p className="text-2xl font-black">{selectedShift.time}</p>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-slate-600">Ghi chú</label>
            <textarea value={form.note} onChange={(e) => update({ note: e.target.value })} rows={2} maxLength={500} placeholder="VD: Đăng ký ca A theo lịch phân công tuần này..." className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100" />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" disabled={submitting} onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-3 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50">Hủy</button>
            <button type="submit" disabled={submitting || !form.roomId || !form.workDate || !form.shiftCode} className="flex-1 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 py-3 text-xs font-black text-white shadow-lg shadow-cyan-600/25 hover:from-cyan-700 hover:to-blue-700 disabled:opacity-60">{submitting ? 'Đang gửi...' : 'Gửi đăng ký'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function HistoryModal({ shifts, loading, onClose }) {
  const [filter, setFilter] = useState('');
  const filtered = useMemo(() => (filter ? shifts.filter((shift) => shift.status === filter) : shifts), [shifts, filter]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-5">
          <div className="flex items-center justify-between">
            <div><h3 className="text-lg font-black text-white">Lịch sử đăng ký ca</h3><p className="mt-1 text-xs text-slate-400">Danh sách ca A/B bạn đã đăng ký.</p></div>
            <button onClick={onClose} className="rounded-xl border border-slate-600 px-4 py-2 text-xs font-black text-slate-300 hover:bg-slate-700">Đóng</button>
          </div>
          <div className="mt-3 flex gap-1.5">
            {['', 'PENDING', 'APPROVED', 'REJECTED'].map((status) => <button key={status} onClick={() => setFilter(status)} className={`rounded-lg px-3 py-1.5 text-[10px] font-bold ${filter === status ? 'bg-white text-slate-900 shadow' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}>{status ? STATUS_META[status]?.label || status : 'Tất cả'}</button>)}
          </div>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {loading ? <LoadingIndicator size="md" label="Đang tải lịch sử..." /> : filtered.length === 0 ? <div className="py-12 text-center text-xs font-bold text-slate-400">Chưa có ca trực nào.</div> : filtered.map((shift) => {
            const meta = STATUS_META[shift.status] || STATUS_META.PENDING;
            const code = shift.shiftCode || (new Date(shift.startTime).getHours() < 12 ? 'A' : 'B');
            return (
              <div key={shift.id} className={`flex items-center justify-between gap-3 rounded-2xl border p-3 ${meta.bg}`}>
                <div className="min-w-0">
                  <p className="text-xs font-black">{formatDateLocal(new Date(shift.workDate || shift.startTime))} · {SHIFT_WINDOWS[code]?.label}</p>
                  <p className="mt-0.5 text-[11px] font-bold">{SHIFT_WINDOWS[code]?.time || `${formatTimeLocal(shift.startTime)} - ${formatTimeLocal(shift.endTime)}`}</p>
                  <p className="mt-0.5 max-w-[300px] truncate text-[10px] text-slate-500">Ghi chú: {shift.note || 'Không có'}</p>
                  {shift.status === 'REJECTED' && <p className="mt-0.5 text-[10px] text-red-600">Lý do: {shift.rejectionReason || 'Không có'}</p>}
                </div>
                <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[10px] font-black ${meta.bg}`}><span className={`mr-1 h-1.5 w-1.5 rounded-full ${meta.dot}`} />{meta.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

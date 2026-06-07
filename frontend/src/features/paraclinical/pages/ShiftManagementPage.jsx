import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { usePreferences } from '../../../providers/PreferencesProvider';
import { useToast } from '../../../providers/ToastProvider';
import { shiftService } from '../apis/paraclinicalService';
import { LAB_MANAGER_NAV_ITEMS, labManagerRouteFor } from '../../lab-manager/constants/navigation';
import api from '../../../shared/apis/api';

/* ── Constants ──────────────────────────────────────────────────── */
const STATUS_META = {
  PENDING:   { label: 'Chờ duyệt', dot: 'bg-amber-400', bg: 'bg-amber-50 border-amber-200 text-amber-800' },
  APPROVED:  { label: 'Đã duyệt',  dot: 'bg-emerald-500', bg: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  REJECTED:  { label: 'Từ chối',  dot: 'bg-red-400', bg: 'bg-red-50 border-red-200 text-red-700' },
  CANCELLED: { label: 'Đã hủy',   dot: 'bg-slate-400', bg: 'bg-slate-50 border-slate-200 text-slate-600' },
};

const DAYS_OF_WEEK = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 20; // px per hour for the timeline (compact)

/* ── Helpers ────────────────────────────────────────────────────── */
function toLocalISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function pad(n) { return String(n).padStart(2, '0'); }
function formatTimeLocal(iso) {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function formatDateLocal(d) { return `${d.getDate()}/${d.getMonth() + 1}`; }

/** Generate all days for a given month (year, 0-indexed month) */
function getMonthDays(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days = [];
  // Add days from previous month to fill first week
  const startDow = (firstDay.getDay() + 6) % 7; // Mon=0
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: d, isOtherMonth: true });
  }
  // Current month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push({ date: new Date(year, month, d), isOtherMonth: false });
  }
  // Next month to fill last week
  const remaining = (7 - (days.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    days.push({ date: new Date(year, month + 1, i), isOtherMonth: true });
  }
  return days;
}

/* ==================================================================
   Main Page
   ================================================================== */
export default function ShiftManagementPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const today = new Date();

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [myShifts, setMyShifts] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Room selector
  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');

  // Drag state
  const [dragDay, setDragDay] = useState(null); // date object of day being dragged on
  const [dragStartY, setDragStartY] = useState(null);
  const [dragEndY, setDragEndY] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const calendarRef = useRef(null);

  // Register form
  const [registerForm, setRegisterForm] = useState({ roomId: '', startTime: '', endTime: '', note: '' });

  const isManager = user?.isManager || false;
  const { prefs } = usePreferences();
  const demoMode = prefs.demoMode || false;

  /* ── Derived ────────────────────────────────────────────────── */
  const monthDays = useMemo(() => getMonthDays(year, month), [year, month]);
  const monthLabel = useMemo(() => {
    return `Tháng ${month + 1}/${year}`;
  }, [year, month]);

  // Build shift map: dateStr -> shifts[]
  const shiftsByDate = useMemo(() => {
    const map = {};
    shifts.forEach(s => {
      const key = toLocalISODate(new Date(s.startTime));
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [shifts]);

  /* ── Fetch rooms ─────────────────────────────────────────────── */
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        // Load all clinical rooms
        const res = await api.get('/clinical-rooms');
        let list = Array.isArray(res.data) ? (Array.isArray(res.data?.data) ? res.data.data : res.data) : (res.data?.items || []);

        // Filter: only show rooms belonging to LABORATORY or IMAGING departments
        // (exclude doctor exam rooms and reception rooms)
        list = list.filter(room => {
          const deptType = room.doctor?.staffProfile?.department?.type;
          // Include rooms whose doctor belongs to LAB/IMAGING, or rooms with no doctor (unassigned)
          return !deptType || deptType === 'LABORATORY' || deptType === 'IMAGING';
        });

        console.log('[ShiftManagement] clinical rooms filtered (LAB/IMAGING only):', list.length, list.map(r => `${r.roomName} (dept: ${r.doctor?.staffProfile?.department?.type || 'none'})`));

        if (mounted) {
          setRooms(list);
          if (!selectedRoomId && list.length > 0) {
            setSelectedRoomId(list[0].id);
          }
        }
      } catch { /* ignore */ }
    }
    load();
    return () => { mounted = false; };
  }, []);

  /* ── API ────────────────────────────────────────────────────── */
  const loadShifts = useCallback(async () => {
    setLoading(true);
    try {
      const from = toLocalISODate(monthDays[0]?.date);
      const to = toLocalISODate(monthDays[monthDays.length - 1]?.date);
      const roomId = selectedRoomId;
      if (roomId && from && to) {
        const res = await shiftService.listByRoom(roomId, `${from}T00:00:00Z`, `${to}T23:59:59Z`);
        setShifts(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      console.error('Failed to load shifts:', err);
    } finally { setLoading(false); }
  }, [selectedRoomId, monthDays]);

  const loadMyShifts = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const roomId = selectedRoomId;
      if (!roomId) return;
      const from = new Date();
      from.setFullYear(from.getFullYear() - 1);
      const res = await shiftService.listByRoom(roomId, from.toISOString(), new Date().toISOString());
      const all = Array.isArray(res.data) ? res.data : [];
      setMyShifts(all.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()));
    } catch { /* ignore */ } finally { setHistoryLoading(false); }
  }, [selectedRoomId]);

  useEffect(() => { loadShifts(); }, [loadShifts]);
  useEffect(() => { if (showHistory) loadMyShifts(); }, [showHistory, loadMyShifts]);

  /* ── Navigation ─────────────────────────────────────────────── */
  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };
  const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); };

  /* ── Drag handlers ──────────────────────────────────────────── */
  const getYFromEvent = (e) => {
    const rect = calendarRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return clientY - rect.top;
  };

  const handleMouseDown = (day, e) => {
    const dayDate = toLocalISODate(day.date);
    // Respect demo mode: if demo is ON, allow past days
    if (!demoMode && dayDate < toLocalISODate(new Date())) return;
    setIsDragging(true);
    setDragDay(day);
    const y = getYFromEvent(e);
    setDragStartY(y);
    setDragEndY(y);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const y = getYFromEvent(e);
    setDragEndY(Math.max(0, Math.min(y, HOUR_HEIGHT * 24)));
  };

  const handleMouseUp = () => {
    if (!isDragging || !dragDay) { setIsDragging(false); return; }

    const startHour = Math.floor(Math.min(dragStartY, dragEndY) / HOUR_HEIGHT);
    const endHour = Math.ceil(Math.max(dragStartY, dragEndY) / HOUR_HEIGHT);
    const duration = endHour - startHour;

    if (duration < 1) {
      toast.info('Ca trực phải kéo dài ít nhất 1 giờ.', 4000);
      setIsDragging(false);
      return;
    }

    const dayDate = toLocalISODate(dragDay.date);
    setRegisterForm({
      roomId: user?.clinicalRoomId || '',
      startTime: `${dayDate}T${pad(startHour)}:00`,
      endTime: `${dayDate}T${pad(endHour)}:00`,
      note: '',
    });
    setShowRegister(true);
    setIsDragging(false);
  };

  // Refs for cleanup
  useEffect(() => {
    const handleGlobalUp = () => { if (isDragging) handleMouseUp(); };
    const handleGlobalMove = (e) => { if (isDragging) handleMouseMove(e); };
    window.addEventListener('mouseup', handleGlobalUp);
    window.addEventListener('mousemove', handleGlobalMove);
    window.addEventListener('touchend', handleGlobalUp);
    window.addEventListener('touchmove', handleGlobalMove);
    return () => {
      window.removeEventListener('mouseup', handleGlobalUp);
      window.removeEventListener('mousemove', handleGlobalMove);
      window.removeEventListener('touchend', handleGlobalUp);
      window.removeEventListener('touchmove', handleGlobalMove);
    };
  }, [isDragging, dragStartY, dragEndY, dragDay]);

  /* ── Register ────────────────────────────────────────────────── */
  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await shiftService.register(registerForm.roomId, registerForm.startTime, registerForm.endTime, registerForm.note);
      toast.success('Đăng ký ca trực thành công!');
      setShowRegister(false);
      setRegisterForm({ roomId: user?.clinicalRoomId || '', startTime: '', endTime: '', note: '' });
      loadShifts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Đăng ký thất bại');
    }
  };

  /* ── Render helpers ──────────────────────────────────────────── */
  const renderShiftBar = (shift) => {
    const start = new Date(shift.startTime);
    const end = new Date(shift.endTime);
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = end.getHours() * 60 + end.getMinutes();
    const top = (startMinutes / 60) * HOUR_HEIGHT;
    const height = Math.max(((endMinutes - startMinutes) / 60) * HOUR_HEIGHT, 20);
    const meta = STATUS_META[shift.status] || STATUS_META.PENDING;

    const isMorning = start.getHours() >= 6 && start.getHours() < 12;
    const isAfternoon = start.getHours() >= 12 && start.getHours() < 18;
    const isNight = start.getHours() >= 18 || start.getHours() < 6;
    let barClass = 'bg-gradient-to-br from-slate-100 to-slate-200 border-slate-300 text-slate-700';
    if (shift.status === 'APPROVED') {
      if (isMorning) barClass = 'bg-gradient-to-br from-amber-100 to-amber-200 border-amber-300 text-amber-900';
      else if (isAfternoon) barClass = 'bg-gradient-to-br from-cyan-100 to-cyan-200 border-cyan-300 text-cyan-900';
      else if (isNight) barClass = 'bg-gradient-to-br from-indigo-200 to-indigo-300 border-indigo-400 text-indigo-900';
    } else if (shift.status === 'REJECTED') {
      barClass = 'bg-gradient-to-br from-red-50 to-red-100 border-red-200 text-red-700 opacity-60';
    }

    return (
      <div
        key={shift.id}
        className={`absolute left-0.5 right-0.5 rounded-lg border px-1.5 py-0.5 text-[9px] leading-tight font-bold overflow-hidden cursor-pointer transition-all hover:ring-2 hover:ring-offset-1 hover:z-10 ${barClass}`}
        style={{ top: `${top}px`, height: `${height}px` }}
        title={`${shift.staff?.fullName || 'N/A'}: ${formatTimeLocal(shift.startTime)} - ${formatTimeLocal(shift.endTime)} (${meta.label})${shift.note ? ' - ' + shift.note : ''}`}
      >
        <div className="truncate">{shift.staff?.fullName || 'N/A'}</div>
        <div className="opacity-70 truncate">{formatTimeLocal(shift.startTime)}-{formatTimeLocal(shift.endTime)}</div>
      </div>
    );
  };

  /* ================================================================
     RENDER
     ================================================================ */
  return (
    <DashboardLayout user={user} navItems={LAB_MANAGER_NAV_ITEMS} activeItem="shifts" onNavigate={(id) => navigate(labManagerRouteFor(id))} onLogout={logout}>
      <div className="max-w-7xl mx-auto space-y-4 pb-12">
        {/* Header */}
        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] font-black text-cyan-600">
                  {isManager && <span className="inline-block mr-2 rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">Trưởng khoa</span>}
                  Lịch trực CLS
                </p>
                <h1 className="mt-1 text-2xl font-black text-slate-950">Đăng ký ca trực</h1>
                <p className="mt-1 text-xs text-slate-400">Kéo thả trên lịch để chọn giờ trực, hoặc bấm [+ Đăng ký] để nhập thủ công.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {rooms.length > 0 && (
                  <select
                    value={selectedRoomId}
                    onChange={(e) => setSelectedRoomId(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition-all"
                  >
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>{r.roomName || r.roomCode || r.id.slice(0, 8)}</option>
                    ))}
                  </select>
                )}
                <button onClick={prevMonth} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">←</button>
                <button onClick={goToday} className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-bold text-cyan-700">{monthLabel}</button>
                <button onClick={nextMonth} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">→</button>
                <button onClick={goToday} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50">Hôm nay</button>
                <button
                  onClick={() => {
                    setRegisterForm({ roomId: selectedRoomId || '', startTime: '', endTime: '', note: '' });
                    setShowRegister(true);
                  }}
                  className="rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-black text-white hover:bg-cyan-700 ml-2 shadow-sm"
                >
                  + Đăng ký ca
                </button>
                <button data-history-btn onClick={() => setShowHistory(true)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black text-slate-600 hover:bg-slate-50">
                  Lịch sử đăng ký
                </button>
              </div>
            </div>
            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold text-slate-500">
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-amber-300 border border-amber-400" /> Sáng (6h-12h)</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-cyan-300 border border-cyan-400" /> Chiều (12h-18h)</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-indigo-300 border border-indigo-400" /> Tối (18h-6h)</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-amber-400" /> Chờ duyệt</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-emerald-500" /> Đã duyệt</span>
              <span className="text-slate-400 ml-2">💡 Kéo chuột trên ô ngày để chọn giờ</span>
            </div>
          </div>
        </section>

        {/* Calendar Grid */}
        {loading ? (
          <LoadingIndicator size="lg" label="Đang tải lịch trực..." />
        ) : (
          <section className="rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden" ref={calendarRef} style={{ maxHeight: '70vh' }}>
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/80 sticky top-0 z-10">
              {DAYS_OF_WEEK.map((day, idx) => (
                <div key={idx} className="py-2.5 text-center border-r border-slate-100 last:border-r-0">
                  <span className="text-[11px] font-black uppercase text-slate-400">{day}</span>
                </div>
              ))}
            </div>

            {/* Calendar body - week rows with scroll */}
            <div className="grid grid-cols-7 overflow-y-auto" style={{ maxHeight: 'calc(70vh - 36px)' }}>
              {monthDays.map((day, idx) => {
                const dateStr = toLocalISODate(day.date);
                const isToday = dateStr === toLocalISODate(today);
                const isPast = demoMode ? false : dateStr < toLocalISODate(today);
                const dayShifts = shiftsByDate[dateStr] || [];

                return (
                  <CalendarCell
                    key={idx}
                    day={day}
                    isToday={isToday}
                    isPast={isPast}
                    shifts={dayShifts}
                    isDragging={isDragging}
                    dragDay={dragDay}
                    dragStartY={dragStartY}
                    dragEndY={dragEndY}
                    onMouseDown={(e) => handleMouseDown(day, e)}
                    renderShift={renderShiftBar}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* Register Modal */}
        {showRegister && (
          <RegisterModal
            form={registerForm}
            setForm={setRegisterForm}
            onSubmit={handleRegister}
            onClose={() => setShowRegister(false)}
            rooms={rooms}
            demoMode={demoMode}
          />
        )}

        {/* History Modal */}
        {showHistory && (
          <HistoryModal
            shifts={myShifts}
            loading={historyLoading}
            onClose={() => setShowHistory(false)}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

/* ==================================================================
   CalendarCell — One day cell with timeline
   ================================================================== */
function CalendarCell({ day, isToday, isPast, shifts, isDragging, dragDay, dragStartY, dragEndY, onMouseDown, renderShift }) {
  const dateStr = toLocalISODate(day.date);
  const isDragTarget = isDragging && dragDay?.date && toLocalISODate(dragDay.date) === dateStr;
  const cellHeight = HOUR_HEIGHT * 24;

  return (
    <div
      className={`relative border-r border-b border-slate-100 last:border-r-0 ${day.isOtherMonth ? 'bg-slate-50/50' : isToday ? 'bg-cyan-50/30' : 'bg-white'} ${isPast && !day.isOtherMonth ? 'bg-slate-50/70' : ''} ${isDragTarget ? 'ring-2 ring-cyan-400 ring-inset z-10' : ''}`}
      style={{ minHeight: `${cellHeight}px` }}
      onMouseDown={(day.isOtherMonth || (!isDragTarget && isPast)) ? undefined : onMouseDown}
    >
      {/* Date label */}
      <div className={`sticky top-0 z-10 flex items-center justify-between px-1.5 py-0.5 bg-white/80 backdrop-blur border-b border-slate-100 ${day.isOtherMonth ? 'text-slate-300' : isToday ? 'text-cyan-700 font-black' : 'text-slate-600 font-bold'} text-[10px]`}>
        <span>{day.date.getDate()}</span>
        {!day.isOtherMonth && !isPast && (
          <span className="text-[8px] text-slate-300 select-none" title="Kéo để chọn giờ">⏱</span>
        )}
      </div>

      {/* Hour grid lines */}
      <div className="relative" style={{ height: `${cellHeight - 20}px` }}>
        {/* Only show even hours to reduce visual noise */}
        {HOURS.filter(h => h % 3 === 0).map(h => (
          <div
            key={h}
            className="absolute left-0 right-0 border-t border-slate-100 pointer-events-none"
            style={{ top: `${h * HOUR_HEIGHT}px` }}
          >
            <span className="absolute left-0.5 top-0 text-[7px] text-slate-300 leading-none">{h}h</span>
          </div>
        ))}

        {/* Drag preview */}
        {isDragTarget && dragStartY !== null && dragEndY !== null && (
          <div
            className="absolute left-1 right-1 rounded-lg bg-cyan-400/30 border-2 border-dashed border-cyan-500 z-20 pointer-events-none flex items-center justify-center"
            style={{
              top: `${Math.min(dragStartY, dragEndY)}px`,
              height: `${Math.abs(dragEndY - dragStartY)}px`,
            }}
          >
            <span className="text-[9px] font-black text-cyan-700 bg-white/80 rounded px-1">
              {Math.round(Math.abs(dragEndY - dragStartY) / HOUR_HEIGHT * 2) / 2}h
            </span>
          </div>
        )}

        {/* Shift bars */}
        {shifts.map(s => renderShift(s))}

        {/* No shifts empty state */}
        {!day.isOtherMonth && shifts.length === 0 && !isDragTarget && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-[9px] text-slate-200 select-none">{isPast ? '—' : 'Kéo để chọn giờ'}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ==================================================================
   RegisterModal
   ================================================================== */
function RegisterModal({ form, setForm, onSubmit, onClose, rooms, demoMode = false }) {
  const today = new Date();
  const minDate = demoMode ? '2020-01-01' : toLocalISODate(today);
  const maxDate = demoMode ? '2030-12-31' : toLocalISODate(new Date(today.getFullYear(), today.getMonth() + 2, 0));

  const update = (patch) => setForm({ ...form, ...patch });

  // Auto-set end time when start time changes
  const handleStartChange = (value) => {
    update({ startTime: value });
    if (value && !form.endTime) {
      // Default: start + 4h
      const start = new Date(value);
      start.setHours(start.getHours() + 4);
      const endStr = toLocalISODate(start) + 'T' + pad(start.getHours()) + ':' + pad(start.getMinutes());
      update({ startTime: value, endTime: endStr });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="rounded-3xl bg-white shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-slideUp">
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 p-5">
          <h3 className="text-lg font-black text-white">Đăng ký ca trực mới</h3>
          <p className="text-xs text-cyan-100 mt-1">Chọn ngày giờ bạn muốn đăng ký làm việc.</p>
        </div>
        <form onSubmit={onSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-[11px] font-black text-slate-600 mb-1.5 uppercase tracking-wider">Phòng làm việc</label>
            {rooms.length > 0 ? (
              <select
                value={form.roomId}
                onChange={(e) => setForm({ ...form, roomId: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 bg-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition-all"
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>{r.roomName || r.roomCode} - {r.roomCode}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={form.roomId}
                readOnly
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-500 outline-none cursor-not-allowed"
                placeholder="Đang tải danh sách phòng..."
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-black text-slate-600 mb-1.5 uppercase tracking-wider">Bắt đầu <span className="text-red-500">*</span></label>
              <input
                type="datetime-local"
                value={form.startTime}
                min={`${minDate}T00:00`}
                max={`${maxDate}T23:59`}
                onChange={(e) => handleStartChange(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 outline-none transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-black text-slate-600 mb-1.5 uppercase tracking-wider">Kết thúc <span className="text-red-500">*</span></label>
              <input
                type="datetime-local"
                value={form.endTime}
                min={form.startTime || `${minDate}T00:00`}
                max={`${maxDate}T23:59`}
                onChange={(e) => update({ endTime: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 outline-none transition-all"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-black text-slate-600 mb-1.5 uppercase tracking-wider">
              Lý do / Ghi chú <span className="font-medium text-slate-400">(tùy chọn)</span>
            </label>
            <textarea
              value={form.note}
              onChange={(e) => update({ note: e.target.value })}
              rows={2}
              maxLength={500}
              placeholder="VD: Đăng ký ca sáng vì có lịch cá nhân buổi chiều..."
              className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 outline-none transition-all"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-black text-slate-600 hover:bg-slate-50 transition-all">Hủy</button>
            <button type="submit" className="flex-1 rounded-xl bg-cyan-600 py-2.5 text-xs font-black text-white hover:bg-cyan-700 shadow-lg shadow-cyan-600/25 transition-all">Đăng ký</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ==================================================================
   HistoryModal — Shows all registered shifts for the current user
   ================================================================== */
function HistoryModal({ shifts, loading, onClose }) {
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => {
    if (!filter) return shifts;
    return shifts.filter(s => s.status === filter);
  }, [shifts, filter]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="rounded-3xl bg-white shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col overflow-hidden animate-slideUp">
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-5 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-white">Lịch sử đăng ký ca</h3>
              <p className="text-xs text-slate-400 mt-1">Danh sách tất cả ca bạn đã đăng ký.</p>
            </div>
            <button onClick={onClose} className="rounded-xl border border-slate-600 px-4 py-2 text-xs font-black text-slate-300 hover:bg-slate-700 transition-all">Đóng</button>
          </div>
          <div className="flex gap-1.5 mt-3">
            {['', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map(status => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`rounded-lg px-3 py-1.5 text-[10px] font-bold transition-all ${filter === status ? 'bg-white text-slate-900 shadow' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
              >
                {status ? (STATUS_META[status]?.label || status) : 'Tất cả'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <LoadingIndicator size="md" label="Đang tải lịch sử..." />
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-400 font-bold">Chưa có ca trực nào được đăng ký.</div>
          ) : (
            filtered.map(shift => {
              const meta = STATUS_META[shift.status] || STATUS_META.PENDING;
              const dateStr = new Date(shift.startTime).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
              return (
                <div key={shift.id} className={`rounded-2xl border p-3 flex items-center justify-between gap-3 ${meta.bg}`}>
                  <div className="min-w-0">
                    <p className="text-xs font-black">{dateStr}</p>
                    <p className="text-[11px] font-bold mt-0.5">{formatTimeLocal(shift.startTime)} - {formatTimeLocal(shift.endTime)}</p>
                    {shift.note && <p className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[300px]">{shift.note}</p>}
                    {shift.status === 'REJECTED' && shift.rejectionReason && (
                      <p className="text-[10px] text-red-600 mt-0.5">Lý do từ chối: {shift.rejectionReason}</p>
                    )}
                  </div>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-black shrink-0 ${meta.bg}`}>
                    <span className={`mr-1 h-1.5 w-1.5 rounded-full ${meta.dot}`} /> {meta.label}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

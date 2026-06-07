import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { useToast } from '../../../providers/ToastProvider';
import { Sunrise, Sun, Sunset, Moon } from 'lucide-react';
import { receptionShiftService } from '../apis/receptionShiftService';
import { departmentService } from '../../admin/apis/departmentService';
import { RECEPTIONIST_NAV_ITEMS, receptionistRouteFor } from '../constants/navigation';
import { profileService } from '../../profile/apis/profileService';
import RejectReasonModal from '../../../shared/components/RejectReasonModal';

// Preset shift templates the user drags onto the calendar.
// Hours are in local time and produce ISO-formatted strings on submit.
// Each preset uses a Lucide icon component (rendered as React node) so it stays
// crisp regardless of the OS emoji font.
const SHIFT_PRESETS = [
  { id: 'morning',   label: 'Sáng',  range: '08:00 → 12:00', startHour: 8,  endHour: 12, gradient: 'from-amber-200 to-amber-100',   text: 'text-amber-900',  dot: 'bg-amber-500',  Icon: Sunrise },
  { id: 'afternoon', label: 'Chiều', range: '13:00 → 17:00', startHour: 13, endHour: 17, gradient: 'from-cyan-200 to-cyan-100',     text: 'text-cyan-900',   dot: 'bg-cyan-500',   Icon: Sun },
  { id: 'evening',   label: 'Tối',   range: '18:00 → 22:00', startHour: 18, endHour: 22, gradient: 'from-violet-200 to-violet-100', text: 'text-violet-900', dot: 'bg-violet-500', Icon: Sunset },
  { id: 'night',     label: 'Đêm',   range: '22:00 → 06:00', startHour: 22, endHour: 30, gradient: 'from-slate-700 to-slate-500',   text: 'text-white',      dot: 'bg-slate-300',  Icon: Moon },
];

const STATUS_META = {
  PENDING:  { label: 'Chờ duyệt', dot: 'bg-amber-400',  bg: 'bg-amber-50 border-amber-200 text-amber-800' },
  APPROVED: { label: 'Đã duyệt',  dot: 'bg-emerald-500', bg: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  REJECTED: { label: 'Từ chối',   dot: 'bg-red-400',     bg: 'bg-red-50 border-red-200 text-red-700' },
};

const DAYS_OF_WEEK = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function getWeekDays(offset = 0) {
  const start = new Date();
  start.setDate(start.getDate() + offset * 7);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Move to Monday
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function fmtShortDate(d) {
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

// True when `d` is strictly before today (compared at day granularity, not by hour).
// Used to disable past calendar cells in the drag-and-drop calendar.
function isPastDay(d) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return target < today;
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

// Compose start/end Date for a preset on a given day; the night shift (22→06)
// rolls over into the next day, so we add 24h to endHour-22 when endHour > 24.
function buildShiftDates(day, preset) {
  const start = new Date(day);
  start.setHours(preset.startHour, 0, 0, 0);
  const end = new Date(day);
  if (preset.endHour > 24) {
    end.setDate(end.getDate() + 1);
    end.setHours(preset.endHour - 24, 0, 0, 0);
  } else {
    end.setHours(preset.endHour, 0, 0, 0);
  }
  return { start, end };
}

function getWeeksOfMonth(year, month) {
  const weeks = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Get Monday of the week containing firstDay
  const start = new Date(firstDay);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);

  const curr = new Date(start);
  while (curr <= lastDay || curr.getMonth() === month) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
    }
    if (week.some((d) => d.getMonth() === month)) {
      weeks.push(week);
    }
  }
  return weeks;
}

export default function ReceptionShiftPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [shifts, setShifts] = useState([]);
  const [pending, setPending] = useState([]);
  const [stats, setStats] = useState({ visitsToday: 0, shiftsToday: 0, onDutyNow: 0 });
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const isAdmin = user?.role === 'ADMIN';

  // Rejection modal target (replaces the old window.prompt).
  const [rejectTarget, setRejectTarget] = useState(null);
  // Optional-note modal shown after a preset is dropped, before the shift is submitted.
  const [pendingDrop, setPendingDrop] = useState(null); // { day, preset } | null
  const [dropNote, setDropNote] = useState('');

  // Drag state for the visual cue.
  const [draggingPreset, setDraggingPreset] = useState(null);
  const [hoverCell, setHoverCell] = useState(null); // `${dayIdx}` while a preset hovers a day

  const [filterType, setFilterType] = useState('week'); // 'week', 'month', 'custom'
  const [selectedMonth, setSelectedMonth] = useState(''); // 'YYYY-MM'
  const [viewFromDate, setViewFromDate] = useState('');
  const [viewToDate, setViewToDate] = useState('');

  // Generate the last 12 months for filtering
  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      const label = `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`;
      options.push({ value, label });
    }
    return options;
  }, []);

  // Initialize selectedMonth with current month
  useEffect(() => {
    if (!selectedMonth) {
      const now = new Date();
      setSelectedMonth(`${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`);
    }
  }, [selectedMonth]);

  const calendarWeeks = useMemo(() => {
    if (filterType === 'month' && selectedMonth) {
      const [year, month] = selectedMonth.split('-').map(Number);
      return getWeeksOfMonth(year, month - 1);
    }
    if (filterType === 'custom' && viewFromDate && viewToDate) {
      const start = new Date(viewFromDate);
      const end = new Date(viewToDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);

      // Align start date to Monday of that week
      const day = start.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      start.setDate(start.getDate() + diff);

      const weeks = [];
      const curr = new Date(start);
      // Limit to maximum 5 weeks to prevent excessive rendering
      for (let w = 0; w < 5; w++) {
        if (curr > end) break;
        const week = [];
        for (let i = 0; i < 7; i++) {
          week.push(new Date(curr));
          curr.setDate(curr.getDate() + 1);
        }
        weeks.push(week);
      }
      return weeks;
    }
    return [getWeekDays(weekOffset)];
  }, [filterType, selectedMonth, viewFromDate, viewToDate, weekOffset]);

  const filteredHistoryShifts = useMemo(() => {
    if (!selectedMonth) return shifts;
    const [year, month] = selectedMonth.split('-').map(Number);
    return shifts.filter((s) => {
      const d = new Date(s.startTime);
      return d.getFullYear() === year && (d.getMonth() + 1) === month;
    });
  }, [shifts, selectedMonth]);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset, filterType, selectedMonth, viewFromDate, viewToDate]);

  // Auto-pick the first administrative department once departments load (if not set by profile).
  useEffect(() => {
    if (!selectedDept && departments.length > 0) setSelectedDept(departments[0].id);
  }, [departments, selectedDept]);

  async function loadAll() {
    setLoading(true);
    try {
      const [shiftsRes, pendingRes, statsRes, depRes, profileRes] = await Promise.all([
        receptionShiftService.list({}),
        receptionShiftService.listPendingForMe().catch(() => ({ data: [] })),
        receptionShiftService.statsToday().catch(() => ({ data: { visitsToday: 0, shiftsToday: 0, onDutyNow: 0 } })),
        departmentService.list({ type: 'ADMINISTRATIVE' }).catch(() => ({ data: [] })),
        profileService.getProfile().catch(() => null),
      ]);
      const shiftList = Array.isArray(shiftsRes.data) ? shiftsRes.data : (shiftsRes.data?.data || []);
      setShifts(shiftList);
      const pendingList = Array.isArray(pendingRes.data) ? pendingRes.data : (pendingRes.data?.data || []);
      setPending(pendingList);
      setStats(statsRes.data?.data || statsRes.data || { visitsToday: 0, shiftsToday: 0, onDutyNow: 0 });

      // Department list comes through the global ApiResponseInterceptor (wraps in `data`)
      // AND the paginated() helper (wraps in `items`).
      const depPayload = depRes.data?.data ?? depRes.data;
      const depList = Array.isArray(depPayload)
        ? depPayload
        : Array.isArray(depPayload?.items)
          ? depPayload.items
          : [];
      const adminDepts = depList.filter((d) => d.type === 'ADMINISTRATIVE');
      setDepartments(adminDepts);

      if (profileRes?.data?.profile?.staff?.departmentId) {
        setSelectedDept(profileRes.data.profile.staff.departmentId);
      } else if (adminDepts.length > 0 && !selectedDept) {
        setSelectedDept(adminDepts[0].id);
      }
    } catch (err) {
      console.error('Load reception shift data failed:', err);
    } finally {
      setLoading(false);
    }
  }

  // Drag-and-drop handlers.
  function handleDragStart(presetId) {
    return (event) => {
      event.dataTransfer.setData('text/plain', presetId);
      event.dataTransfer.effectAllowed = 'copy';
      setDraggingPreset(presetId);
    };
  }

  function handleDragEnd() {
    setDraggingPreset(null);
    setHoverCell(null);
  }

  function handleDragOver(dayIdx, day) {
    return (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      if (isPastDay(day)) {
        setHoverCell(null);
      } else {
        setHoverCell(dayIdx);
      }
    };
  }

  function handleDrop(day) {
    return (event) => {
      event.preventDefault();
      const presetId = event.dataTransfer.getData('text/plain');
      const preset = SHIFT_PRESETS.find((p) => p.id === presetId);
      setHoverCell(null);
      setDraggingPreset(null);
      if (!preset) return;

      if (isPastDay(day)) {
        toast.error('Không thể đăng ký ca trong ngày đã qua.');
        return;
      }

      if (!selectedDept) {
        toast.error('Vui lòng chọn phòng ban hành chính trước.');
        return;
      }

      const { start } = buildShiftDates(day, preset);
      // Verify if shift start time is in the past
      if (start <= new Date()) {
        toast.error(`Không thể đăng ký ca ${preset.label} do thời điểm bắt đầu đã trôi qua.`);
        return;
      }

      // Open the optional-note modal; the actual registration happens on confirm.
      setDropNote('');
      setPendingDrop({ day, preset });
    };
  }

  // Submits the pending drag-drop registration, attaching the optional note.
  async function confirmRegister() {
    if (!pendingDrop) return;
    const { day, preset } = pendingDrop;
    const { start, end } = buildShiftDates(day, preset);
    try {
      await receptionShiftService.register(
        selectedDept,
        start.toISOString(),
        end.toISOString(),
        dropNote.trim() || undefined,
      );
      toast.success(`Đã đăng ký ca ${preset.label} ngày ${fmtShortDate(day)}, đang chờ duyệt.`);
      setPendingDrop(null);
      setDropNote('');
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Đăng ký thất bại.');
    }
  }

  async function handleApprove(id) {
    try {
      await receptionShiftService.approve(id);
      toast.success('Đã duyệt ca trực.');
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Duyệt thất bại.');
    }
  }

  function handleReject(id) {
    const shift = pending.find((s) => s.id === id) || shifts.find((s) => s.id === id);
    setRejectTarget(shift || { id });
  }

  async function confirmReject(reason) {
    if (!rejectTarget) return;
    try {
      await receptionShiftService.reject(rejectTarget.id, reason);
      toast.success('Đã từ chối ca trực.');
      setRejectTarget(null);
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Từ chối thất bại.');
    }
  }

  async function handleCancel(id) {
    if (!window.confirm('Hủy đăng ký ca trực này?')) return;
    try {
      await receptionShiftService.cancel(id);
      toast.success('Đã hủy đăng ký.');
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Hủy thất bại.');
    }
  }

  const shiftsForDay = (day) =>
    shifts
      .filter((s) => new Date(s.startTime).toDateString() === day.toDateString())
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  return (
    <DashboardLayout
      user={user}
      navItems={RECEPTIONIST_NAV_ITEMS}
      activeItem="shifts"
      onNavigate={(id) => navigate(receptionistRouteFor(id))}
      onLogout={logout}
    >
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header + KPIs */}
        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] font-black text-cyan-600">Lễ tân · Lịch trực</p>
              <h1 className="mt-1 text-2xl font-black text-slate-950">Kéo - thả ca trực vào ngày bạn muốn đăng ký</h1>
              <p className="mt-1 text-xs font-semibold text-slate-500">Trưởng phòng hoặc quản trị viên sẽ duyệt sau.</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setWeekOffset((w) => w - 1)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">← Tuần trước</button>
              <button onClick={() => setWeekOffset(0)} className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-bold text-cyan-700">Tuần này</button>
              <button onClick={() => setWeekOffset((w) => w + 1)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">Tuần sau →</button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4">
              <p className="text-[10px] font-black uppercase tracking-wide text-cyan-700">Tiếp đón hôm nay</p>
              <p className="mt-1 text-2xl font-black text-cyan-900">{stats.visitsToday}</p>
              <p className="text-[11px] font-bold text-cyan-700/80">tổng lượt khám đã check-in</p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
              <p className="text-[10px] font-black uppercase tracking-wide text-emerald-700">Ca đã duyệt hôm nay</p>
              <p className="mt-1 text-2xl font-black text-emerald-900">{stats.shiftsToday}</p>
              <p className="text-[11px] font-bold text-emerald-700/80">tại phòng tiếp đón của bạn</p>
            </div>
            <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
              <p className="text-[10px] font-black uppercase tracking-wide text-violet-700">Đang trực ngay</p>
              <p className="mt-1 text-2xl font-black text-violet-900">{stats.onDutyNow}</p>
              <p className="text-[11px] font-bold text-violet-700/80">nhân viên trực hiện tại</p>
            </div>
          </div>
        </section>

        {/* Department picker (target of new registrations) */}
        <section className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="text-xs font-black uppercase tracking-wider text-slate-500">Đăng ký cho phòng</p>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            disabled={!isAdmin}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-800 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none flex-1 sm:max-w-xs disabled:bg-slate-50 disabled:text-slate-500"
          >
            {departments.length === 0 && <option value="">-- Không có phòng hành chính --</option>}
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.departmentCode} · {d.name}</option>
            ))}
          </select>
          {departments.length === 0 && (
            <p className="text-[11px] font-bold text-amber-600">Liên hệ quản trị viên để tạo phòng hành chính.</p>
          )}
        </section>

        {/* Drag palette + week calendar */}
        {loading ? (
          <LoadingIndicator size="lg" label="Đang tải lịch trực..." />
        ) : (
          <section className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4">
            {/* Drag palette */}
            <aside className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm h-fit lg:sticky lg:top-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-3">Mẫu ca trực</p>
              <p className="text-[11px] font-semibold text-slate-500 mb-3">Kéo một ca và thả vào ngày bạn muốn.</p>
              <div className="space-y-2">
                {SHIFT_PRESETS.map((preset) => {
                  const Icon = preset.Icon;
                  return (
                    <div
                      key={preset.id}
                      draggable
                      onDragStart={handleDragStart(preset.id)}
                      onDragEnd={handleDragEnd}
                      className={`cursor-grab active:cursor-grabbing rounded-2xl border border-white/0 bg-gradient-to-br ${preset.gradient} ${preset.text} p-3 shadow-sm hover:shadow-md transition-all select-none ${
                        draggingPreset === preset.id ? 'opacity-50 scale-95' : ''
                      }`}
                      title={`Kéo thả để đăng ký ca ${preset.label}`}
                    >
                      <div className="flex items-center justify-between">
                        <Icon className="w-6 h-6" strokeWidth={2} />
                        <span className={`h-2 w-2 rounded-full ${preset.dot}`} />
                      </div>
                      <p className="mt-2 text-sm font-black">{preset.label}</p>
                      <p className="text-[10px] font-bold opacity-80 mt-0.5">{preset.range}</p>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-[10px] font-semibold text-slate-400 leading-relaxed">
                Tip: ca đêm (22:00 → 06:00) sẽ kéo dài qua ngày hôm sau.
              </p>
            </aside>

            {/* Calendar grid container */}
            <div className="space-y-4">
              {/* Date Filter Bar */}
              <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm flex flex-col gap-3 md:flex-row md:items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFilterType('week')}
                    className={`px-3 py-1.5 text-xs font-black rounded-xl transition-all ${
                      filterType === 'week' ? 'bg-cyan-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Xem theo Tuần
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('month')}
                    className={`px-3 py-1.5 text-xs font-black rounded-xl transition-all ${
                      filterType === 'month' ? 'bg-cyan-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Xem theo Tháng
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('custom')}
                    className={`px-3 py-1.5 text-xs font-black rounded-xl transition-all ${
                      filterType === 'custom' ? 'bg-cyan-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Khoảng ngày tùy chọn
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {filterType === 'week' && (
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => setWeekOffset((w) => w - 1)} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">← Tuần trước</button>
                      <button type="button" onClick={() => setWeekOffset(0)} className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-700">Tuần này</button>
                      <button type="button" onClick={() => setWeekOffset((w) => w + 1)} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">Tuần sau →</button>
                    </div>
                  )}

                  {filterType === 'month' && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-500">Tháng:</span>
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-800 focus:border-cyan-400 outline-none bg-white"
                      >
                        {monthOptions.map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {filterType === 'custom' && (
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={viewFromDate}
                        onChange={(e) => setViewFromDate(e.target.value)}
                        className="rounded-xl border border-slate-200 px-2 py-1 text-xs font-bold text-slate-800 outline-none"
                      />
                      <span className="text-xs font-bold text-slate-400">đến</span>
                      <input
                        type="date"
                        value={viewToDate}
                        onChange={(e) => setViewToDate(e.target.value)}
                        className="rounded-xl border border-slate-200 px-2 py-1 text-xs font-bold text-slate-800 outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Weeks list */}
              {calendarWeeks.map((week, wIdx) => {
                const [, targetMonth] = filterType === 'month' && selectedMonth 
                  ? selectedMonth.split('-').map(Number)
                  : [null, null];

                return (
                  <div key={wIdx} className="rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden">
                    {calendarWeeks.length > 1 && (
                      <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex justify-between items-center">
                        <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Tuần {wIdx + 1}</span>
                        <span className="text-[10px] font-bold text-slate-400">
                          {week[0].toLocaleDateString('vi-VN')} - {week[6].toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-7 border-b border-slate-100">
                      {week.map((day, idx) => {
                        const isToday = day.toDateString() === new Date().toDateString();
                        const isMuted = filterType === 'month' && targetMonth !== null && (day.getMonth() + 1) !== targetMonth;
                        return (
                          <div key={idx} className={`p-3 text-center border-r border-slate-100 last:border-r-0 ${isToday ? 'bg-cyan-50' : ''} ${isMuted ? 'bg-slate-50/50' : ''}`}>
                            <p className="text-[10px] font-black uppercase text-slate-400">{DAYS_OF_WEEK[idx]}</p>
                            <p className={`mt-1 text-lg font-black ${isToday ? 'text-cyan-600' : isMuted ? 'text-slate-300' : 'text-slate-800'}`}>{fmtShortDate(day)}</p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-7 auto-rows-fr min-h-[180px]">
                      {week.map((day, idx) => {
                        const dayShifts = shiftsForDay(day).filter((s) => s.status !== 'REJECTED');
                        const isHovered = hoverCell === `${wIdx}-${idx}`;
                        const past = isPastDay(day);
                        const isMuted = filterType === 'month' && targetMonth !== null && (day.getMonth() + 1) !== targetMonth;

                        return (
                          <div
                            key={idx}
                            onDragOver={isMuted ? undefined : handleDragOver(`${wIdx}-${idx}`, day)}
                            onDragLeave={() => setHoverCell((c) => (c === `${wIdx}-${idx}` ? null : c))}
                            onDrop={isMuted ? undefined : handleDrop(day)}
                            className={`p-2 border-r border-slate-100 last:border-r-0 space-y-1.5 transition-colors min-h-[150px] max-h-[320px] overflow-y-auto ${
                              past || isMuted ? 'bg-slate-50 cursor-not-allowed opacity-60' : ''
                            } ${isHovered && !past && !isMuted ? 'bg-cyan-50/70 ring-2 ring-cyan-300 ring-inset' : ''}`}
                          >
                            {dayShifts.length === 0 && !isHovered && !past && !isMuted && (
                              <p className="text-[10px] text-slate-300 text-center mt-12 italic">Thả ca vào đây</p>
                            )}
                            {past && dayShifts.length === 0 && !isMuted && (
                              <p className="text-[10px] text-slate-300 text-center mt-12 italic">Đã qua</p>
                            )}
                            {isMuted && (
                              <p className="text-[10px] text-slate-300 text-center mt-12 italic">Ngoài tháng</p>
                            )}
                            {isHovered && !past && !isMuted && (
                              <p className="text-[10px] font-black text-cyan-700 text-center mt-12">Thả để đăng ký</p>
                            )}
                            {dayShifts.map((s) => {
                              const meta = STATUS_META[s.status] || STATUS_META.PENDING;
                              const startHour = new Date(s.startTime).getHours();
                              let colorClass = 'bg-gradient-to-br from-slate-50 to-slate-100/50 border-slate-200 text-slate-900';
                              if (startHour === 8) {
                                colorClass = 'bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200 text-amber-900';
                              } else if (startHour === 13) {
                                colorClass = 'bg-gradient-to-br from-cyan-50 to-cyan-100/50 border-cyan-200 text-cyan-900';
                              } else if (startHour === 18) {
                                colorClass = 'bg-gradient-to-br from-violet-50 to-violet-100/50 border-violet-200 text-violet-900';
                              } else if (startHour === 22) {
                                colorClass = 'bg-gradient-to-br from-slate-700 to-slate-800 border-slate-900 text-slate-100';
                              }
                              return (
                                <div key={s.id} className={`rounded-xl border p-2 text-[11px] ${colorClass}`}>
                                  <p className="font-black truncate">{s.staff?.fullName || 'Bạn'}</p>
                                  <p className="font-bold opacity-70">{fmtTime(s.startTime)} - {fmtTime(s.endTime)}</p>
                                  <span className="inline-flex items-center gap-1 mt-1 rounded-full bg-white/70 px-2 py-0.5 shadow-sm">
                                    <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                                    <span className="font-bold text-[9px] text-slate-800">{meta.label}</span>
                                  </span>
                                  {s.status === 'PENDING' && (
                                    <button
                                      type="button"
                                      onClick={() => handleCancel(s.id)}
                                      className={`mt-1 block w-full text-[10px] font-bold ${
                                        startHour === 22 ? 'text-slate-300 hover:text-red-400' : 'text-slate-500 hover:text-red-600'
                                      }`}
                                    >
                                      Hủy
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Approval queue (server returns empty when caller cannot approve anything) */}
        {pending.length > 0 && (
          <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-black text-slate-950">Hàng đợi phê duyệt ({pending.length})</h2>
              <p className="text-[11px] font-bold text-slate-500">{isAdmin ? 'Quản trị viên' : 'Trưởng phòng tiếp đón'}</p>
            </div>
            <div className="space-y-2">
              {pending.map((s) => (
                <div key={s.id} className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-950">{s.staff?.fullName || 'N/A'}</p>
                    <p className="text-xs font-bold text-slate-500 mt-1">
                      {s.department?.name || s.departmentId} · {fmtTime(s.startTime)} - {fmtTime(s.endTime)} · {new Date(s.startTime).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleApprove(s.id)} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700">Duyệt</button>
                    <button onClick={() => handleReject(s.id)} className="rounded-xl border border-red-200 px-4 py-2 text-xs font-black text-red-600 hover:bg-red-50">Từ chối</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Registration History */}
        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3 mb-4 gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-950">Lịch sử đăng ký ca trực</h2>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">Hiển thị danh sách tất cả các ca trực đã đăng ký của bạn.</p>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-500">Lọc tháng:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-800 focus:border-cyan-400 outline-none bg-white"
              >
                <option value="">Tất cả</option>
                {monthOptions.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4">Ngày trực</th>
                  <th className="py-3 px-4">Giờ trực</th>
                  <th className="py-3 px-4">Phòng ban</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4">Người duyệt</th>
                  <th className="py-3 px-4">Lý do từ chối / Ghi chú</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs font-bold text-slate-700">
                {filteredHistoryShifts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 italic">Không có dữ liệu ca trực.</td>
                  </tr>
                ) : (
                  filteredHistoryShifts.map((s) => {
                    const meta = STATUS_META[s.status] || STATUS_META.PENDING;
                    const dateStr = new Date(s.startTime).toLocaleDateString('vi-VN');
                    const timeStr = `${fmtTime(s.startTime)} - ${fmtTime(s.endTime)}`;
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4">{dateStr}</td>
                        <td className="py-3 px-4">{timeStr}</td>
                        <td className="py-3 px-4">{s.department?.name || s.departmentId}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-black ${meta.bg}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                            {meta.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-semibold">{s.approvedBy?.username || s.approvedById || '—'}</td>
                        <td className="py-3 px-4 text-slate-500 font-semibold max-w-[200px] truncate" title={s.rejectionReason || s.note}>
                          {s.rejectionReason || s.note || '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {s.status === 'PENDING' && (
                            <button
                              type="button"
                              onClick={() => handleCancel(s.id)}
                              className="text-[10px] font-black text-red-600 hover:text-red-800 hover:underline"
                            >
                              Hủy đăng ký
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Optional-note modal shown after dropping a preset on a day */}
        {pendingDrop && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setPendingDrop(null);
                setDropNote('');
              }
            }}
          >
            <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl">
              <div className="border-b border-slate-100 p-5">
                <h3 className="text-base font-black text-slate-950">Đăng ký ca {pendingDrop.preset.label}</h3>
                <p className="mt-0.5 text-xs font-semibold text-slate-500">
                  Ngày {fmtShortDate(pendingDrop.day)} · {pendingDrop.preset.range}
                </p>
              </div>
              <div className="p-5">
                <label className="mb-1.5 block text-xs font-bold text-slate-600">
                  Lời nhắn <span className="font-semibold text-slate-400">(tùy chọn)</span>
                </label>
                <textarea
                  value={dropNote}
                  onChange={(e) => setDropNote(e.target.value)}
                  rows={3}
                  maxLength={500}
                  autoFocus
                  placeholder="Ví dụ: Tôi xin trực thay đồng nghiệp, hoặc ghi chú cho người duyệt..."
                  className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none transition-colors focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                />
                <p className="mt-1 text-right text-[11px] font-bold text-slate-400">{dropNote.length}/500</p>
              </div>
              <div className="flex gap-2 border-t border-slate-100 p-5">
                <button
                  type="button"
                  onClick={() => { setPendingDrop(null); setDropNote(''); }}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-black text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={confirmRegister}
                  className="flex-1 rounded-xl bg-cyan-600 py-2.5 text-xs font-black text-white hover:bg-cyan-700"
                >
                  Đăng ký ca trực
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rejection reason modal (replaces window.prompt) */}
        <RejectReasonModal
          open={Boolean(rejectTarget)}
          subtitle={rejectTarget?.staff?.fullName ? `Nhân viên: ${rejectTarget.staff.fullName}` : undefined}
          onConfirm={confirmReject}
          onClose={() => setRejectTarget(null)}
        />
      </div>
    </DashboardLayout>
  );
}

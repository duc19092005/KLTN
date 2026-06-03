import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { useToast } from '../../../providers/ToastProvider';
import { shiftService } from '../apis/paraclinicalService';
import { PARACLINICAL_NAV_ITEMS, paraclinicalRouteFor } from '../constants/navigation';

const STATUS_META = {
  PENDING: { label: 'Chờ duyệt', dot: 'bg-amber-400', bg: 'bg-amber-50 border-amber-200 text-amber-800' },
  APPROVED: { label: 'Đã duyệt', dot: 'bg-emerald-500', bg: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  REJECTED: { label: 'Từ chối', dot: 'bg-red-400', bg: 'bg-red-50 border-red-200 text-red-700' },
};

const DAYS_OF_WEEK = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function getWeekDays(date) {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay() + 1); // Monday
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function formatDate(d) {
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

export default function ShiftManagementPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [showRegister, setShowRegister] = useState(false);
  const [registerForm, setRegisterForm] = useState({ roomId: '', startTime: '', endTime: '' });
  const [rooms, setRooms] = useState([]);
  const [pendingShifts, setPendingShifts] = useState([]);
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'LAB_MANAGER';

  const currentWeek = useMemo(() => {
    const now = new Date();
    now.setDate(now.getDate() + weekOffset * 7);
    return getWeekDays(now);
  }, [weekOffset]);

  useEffect(() => {
    loadShifts();
    if (isAdmin) loadPendingShifts();
  }, [weekOffset]);

  async function loadShifts() {
    setLoading(true);
    try {
      // If user has rooms from shift context, load those; otherwise try all rooms
      const roomId = user?.clinicalRoomId;
      if (roomId) {
        const from = currentWeek[0].toISOString();
        const to = currentWeek[6].toISOString();
        const res = await shiftService.listByRoom(roomId, from, to);
        setShifts(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      console.error('Failed to load shifts:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadPendingShifts() {
    try {
      const res = await shiftService.listPending();
      setPendingShifts(Array.isArray(res.data) ? res.data : []);
    } catch { /* ignore */ }
  }

  async function handleRegister(e) {
    e.preventDefault();
    try {
      await shiftService.register(registerForm.roomId, registerForm.startTime, registerForm.endTime);
      toast.success('Đăng ký ca trực thành công!');
      setShowRegister(false);
      setRegisterForm({ roomId: '', startTime: '', endTime: '' });
      loadShifts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Đăng ký thất bại');
    }
  }

  async function handleApprove(shiftId) {
    try {
      await shiftService.approve(shiftId);
      toast.success('Đã duyệt ca trực!');
      loadPendingShifts();
      loadShifts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Duyệt thất bại');
    }
  }

  async function handleReject(shiftId) {
    try {
      await shiftService.reject(shiftId);
      toast.success('Đã từ chối ca trực');
      loadPendingShifts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Từ chối thất bại');
    }
  }

  const shiftsForDay = (day) =>
    shifts.filter((s) => {
      const start = new Date(s.startTime);
      return start.toDateString() === day.toDateString();
    });

  return (
    <DashboardLayout user={user} navItems={PARACLINICAL_NAV_ITEMS} activeItem="shifts" onNavigate={(id) => navigate(paraclinicalRouteFor(id))} onLogout={logout}>
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] font-black text-cyan-600">Lịch trực CLS</p>
              <h1 className="mt-1 text-2xl font-black text-slate-950">Quản lý ca trực</h1>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setWeekOffset((w) => w - 1)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">← Tuần trước</button>
              <button onClick={() => setWeekOffset(0)} className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-bold text-cyan-700">Tuần này</button>
              <button onClick={() => setWeekOffset((w) => w + 1)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">Tuần sau →</button>
              <button onClick={() => setShowRegister(true)} className="rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-black text-white hover:bg-cyan-700 ml-2">+ Đăng ký trực</button>
            </div>
          </div>
        </section>

        {/* Calendar Grid */}
        {loading ? (
          <LoadingIndicator size="lg" label="Đang tải lịch trực..." />
        ) : (
          <section className="rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <div className="grid grid-cols-7 border-b border-slate-100">
              {currentWeek.map((day, idx) => {
                const isToday = day.toDateString() === new Date().toDateString();
                return (
                  <div key={idx} className={`p-3 text-center border-r border-slate-100 last:border-r-0 ${isToday ? 'bg-cyan-50' : ''}`}>
                    <p className="text-[10px] font-black uppercase text-slate-400">{DAYS_OF_WEEK[(idx + 1) % 7]}</p>
                    <p className={`mt-1 text-lg font-black ${isToday ? 'text-cyan-600' : 'text-slate-800'}`}>{formatDate(day)}</p>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-7 min-h-[320px]">
              {currentWeek.map((day, idx) => {
                const dayShifts = shiftsForDay(day);
                return (
                  <div key={idx} className="p-2 border-r border-slate-100 last:border-r-0 space-y-1.5">
                    {dayShifts.length === 0 && (
                      <p className="text-[10px] text-slate-300 text-center mt-8">Trống</p>
                    )}
                    {dayShifts.map((s) => {
                      const meta = STATUS_META[s.status] || STATUS_META.PENDING;
                      return (
                        <div key={s.id} className={`rounded-xl border p-2 text-[11px] ${meta.bg}`}>
                          <p className="font-black truncate">{s.staff?.fullName || 'N/A'}</p>
                          <p className="font-bold opacity-70">{formatTime(s.startTime)} - {formatTime(s.endTime)}</p>
                          <span className="inline-flex items-center gap-1 mt-1">
                            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                            <span className="font-bold">{meta.label}</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Pending Shifts Approval Queue (Admin/Head only) */}
        {isAdmin && pendingShifts.length > 0 && (
          <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-950 mb-4">Hàng đợi phê duyệt ({pendingShifts.length})</h2>
            <div className="space-y-2">
              {pendingShifts.map((s) => (
                <div key={s.id} className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 flex items-center justify-between">
                  <div>
                    <p className="font-black text-slate-950">{s.staff?.fullName || 'N/A'}</p>
                    <p className="text-xs font-bold text-slate-500 mt-1">
                      {s.clinicalRoom?.roomName} · {formatTime(s.startTime)} - {formatTime(s.endTime)} · {new Date(s.startTime).toLocaleDateString('vi-VN')}
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

        {/* Register Shift Modal */}
        {showRegister && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="rounded-3xl bg-white p-6 shadow-2xl w-full max-w-md mx-4">
              <h3 className="text-lg font-black text-slate-950 mb-4">Đăng ký ca trực mới</h3>
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Mã phòng (Room ID)</label>
                  <input type="text" value={registerForm.roomId} onChange={(e) => setRegisterForm((f) => ({ ...f, roomId: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none" required placeholder="UUID phòng máy" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Bắt đầu</label>
                    <input type="datetime-local" value={registerForm.startTime} onChange={(e) => setRegisterForm((f) => ({ ...f, startTime: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none" required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Kết thúc</label>
                    <input type="datetime-local" value={registerForm.endTime} onChange={(e) => setRegisterForm((f) => ({ ...f, endTime: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none" required />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setShowRegister(false)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-black text-slate-600 hover:bg-slate-50">Hủy</button>
                  <button type="submit" className="flex-1 rounded-xl bg-cyan-600 py-2.5 text-xs font-black text-white hover:bg-cyan-700">Đăng ký</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

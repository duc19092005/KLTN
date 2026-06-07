import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { shiftService } from '../../paraclinical/apis/paraclinicalService';
import { LAB_MANAGER_NAV_ITEMS, labManagerRouteFor } from '../constants/navigation';
import { useToast } from '../../../providers/ToastProvider';
import api from '../../../shared/apis/api';

function getItems(data) { return Array.isArray(data) ? data : data?.items || []; }

export default function LabManagerDashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const isManager = user?.isManager || false;

  useEffect(() => {
    let mounted = true;
    async function loadRooms() {
      try {
        const res = await api.get('/clinical-rooms');
        const list = Array.isArray(res.data) ? (Array.isArray(res.data?.data) ? res.data.data : res.data) : (res.data?.items || []);
        if (mounted && list.length > 0) {
          setRooms(list);
          setSelectedRoomId(list[0].id);
        }
      } catch { /* ignore */ }
    }
    loadRooms();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const today = new Date();
        const from = new Date(today.getFullYear(), today.getMonth(), 1);
        const to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        const roomId = selectedRoomId;
        if (roomId) {
          const res = await shiftService.listByRoom(roomId, from.toISOString(), to.toISOString());
          if (mounted) setShifts(getItems(res.data));
        }
      } catch {
        if (mounted) { /* silent */ }
      } finally { if (mounted) setLoading(false); }
    }
    load();
    return () => { mounted = false; };
  }, [selectedRoomId]);

  const analytics = useMemo(() => {
    const total = shifts.length || 1;
    const statuses = [
      { status: 'APPROVED', label: 'Đã duyệt', key: 'approved' },
      { status: 'PENDING', label: 'Chờ duyệt', key: 'pending' },
      { status: 'REJECTED', label: 'Từ chối', key: 'rejected' },
    ].map(({ status, label, key }) => {
      const count = shifts.filter(s => s.status === status).length;
      return { key, label, count, percent: Math.round((count / total) * 100) };
    });
    return { statuses, total };
  }, [shifts]);

  return (
    <DashboardLayout user={user} navItems={LAB_MANAGER_NAV_ITEMS} activeItem="overview" onNavigate={(id) => navigate(labManagerRouteFor(id))} onLogout={logout}>
      <div className="max-w-7xl mx-auto space-y-4">
        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] font-black text-cyan-600">
                {isManager && <span className="inline-block mr-2 rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 text-[9px]">👑 Trưởng khoa</span>}
                Bảng điều khiển
              </p>
              <h1 className="mt-1 text-2xl font-black text-slate-950">Tổng quan</h1>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
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
              <button onClick={() => navigate('/lab-manager/shifts')} className="rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-black text-white hover:bg-cyan-700 shadow-sm">Đăng ký ca</button>
              {isManager && (
                <button onClick={() => navigate('/admin/shifts')} className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-black text-amber-700 hover:bg-amber-100">Duyệt ca</button>
              )}
            </div>
          </div>
        </section>

        {loading ? <LoadingIndicator size="lg" label="Đang tải thống kê..." /> : (
          <>
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {analytics.statuses.map(row => (
                <Kpi key={row.key} label={row.label} value={row.count} percent={row.percent} tone={row.key === 'approved' ? 'emerald' : row.key === 'pending' ? 'amber' : 'red'} />
              ))}
            </section>
            <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Shortcut title="Đăng ký lịch trực" desc="Xem lịch tháng, kéo thả chọn giờ làm việc." onClick={() => navigate('/lab-manager/shifts')} />
              <Shortcut title="Lịch sử ca trực" desc="Xem tất cả ca đã đăng ký, trạng thái duyệt." onClick={() => {
                navigate('/lab-manager/shifts');
                setTimeout(() => {
                  const btn = document.querySelector('[data-history-btn]');
                  if (btn) btn.click();
                }, 300);
              }} />
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function Kpi({ label, value, percent, tone }) {
  const colors = {
    emerald: { dot: 'bg-emerald-500', bg: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-700' },
    amber:   { dot: 'bg-amber-400',   bg: 'bg-amber-50 border-amber-100',     text: 'text-amber-700' },
    red:     { dot: 'bg-red-400',     bg: 'bg-red-50 border-red-100',         text: 'text-red-600' },
  };
  const c = colors[tone] || colors.emerald;

  return (
    <article className={`rounded-3xl border p-4 shadow-sm ${c.bg}`}>
      <div className="flex items-center justify-between">
        <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
        <strong className="text-2xl font-black text-slate-950">{value}</strong>
      </div>
      <p className={`mt-2 text-xs font-black ${c.text}`}>{label}</p>
      <div className="mt-2 h-1.5 rounded-full bg-slate-200/60 overflow-hidden">
        <div className={`h-full rounded-full ${c.dot}`} style={{ width: `${Math.max(percent, value ? 6 : 0)}%` }} />
      </div>
      <span className="text-[10px] font-bold text-slate-400 mt-1 block">{percent}%</span>
    </article>
  );
}

function Shortcut({ title, desc, onClick }) {
  return (
    <button type="button" onClick={onClick} className="rounded-2xl border border-cyan-100 bg-cyan-50/60 p-5 text-left hover:border-cyan-300 transition-all">
      <strong className="block text-slate-950">{title}</strong>
      <p className="mt-1 text-sm font-semibold text-slate-500">{desc}</p>
    </button>
  );
}

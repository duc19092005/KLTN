import React, { useEffect, useMemo, useState } from 'react';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { visitService } from '../apis/visitService';
import { VISIT_STATUS, getVisitStatus } from '../constants/visitStatus';

export default function VisitQueue({ refreshTrigger }) {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  const [busyId, setBusyId] = useState('');

  const loadVisits = async () => {
    setLoading(true);
    try {
      const res = await visitService.search({ limit: 100 });
      const data = res.data;
      setVisits(Array.isArray(data) ? data : data?.items || []);
    } catch (err) {
      console.error('Failed to load visits', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVisits();
  }, [refreshTrigger]);

  const cancelVisit = async (visit) => {
    if (!window.confirm(`Hủy lượt khám ${visit.visitCode}?`)) return;
    setBusyId(visit.id);
    try {
      await visitService.updateStatus(visit.id, 'CANCELLED');
      await loadVisits();
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể hủy lượt khám');
    } finally {
      setBusyId('');
    }
  };

  const visibleVisits = useMemo(() => {
    const text = query.trim().toLowerCase();
    return visits
      .filter((visit) => !statusFilter || visit.status === statusFilter)
      .filter((visit) => {
        if (!text) return true;
        return [visit.visitCode, visit.patient?.fullName, visit.patient?.patientCode, visit.patient?.phone, visit.clinicalRoom?.roomName, visit.doctor?.staffProfile?.fullName, getVisitStatus(visit.status).label]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(text));
      })
      .sort((a, b) => {
        const left = new Date(a.createdAt || a.checkInAt || 0).getTime();
        const right = new Date(b.createdAt || b.checkInAt || 0).getTime();
        return sortOrder === 'asc' ? left - right : right - left;
      });
  }, [query, sortOrder, statusFilter, visits]);

  const stats = useMemo(() => ({
    all: visits.length,
    waiting: visits.filter((v) => v.status === 'WAITING').length,
    processing: visits.filter((v) => ['IN_PROGRESS', 'WAITING_TEST_RESULT', 'WAITING_CONCLUSION'].includes(v.status)).length,
    completed: visits.filter((v) => v.status === 'COMPLETED').length,
  }), [visits]);

  return (
    <div className="rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 p-5 space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-950">Danh sách lượt khám</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">{visibleVisits.length}/{visits.length} lượt đang hiển thị</p>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <MiniStat label="Tổng" value={stats.all} />
            <MiniStat label="Chờ" value={stats.waiting} />
            <MiniStat label="Xử lý" value={stats.processing} />
            <MiniStat label="Xong" value={stats.completed} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_220px_190px_auto]">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm mã lượt, bệnh nhân, phòng, bác sĩ..." className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold outline-none focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-50" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-600 outline-none focus:border-cyan-400">
            <option value="">Tất cả trạng thái</option>
            {Object.entries(VISIT_STATUS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
          </select>
          <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-600 outline-none focus:border-cyan-400">
            <option value="asc">Cũ trước</option>
            <option value="desc">Mới trước</option>
          </select>
          <button type="button" onClick={loadVisits} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-600 hover:bg-slate-50">
            {loading ? <LoadingIndicator size="sm" /> : 'Làm mới'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-5 py-3">Bệnh nhân</th>
              <th className="px-5 py-3">Mã lượt</th>
              <th className="px-5 py-3">Phòng / Bác sĩ</th>
              <th className="px-5 py-3">Trạng thái</th>
              <th className="px-5 py-3">Giờ tạo</th>
              <th className="px-5 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleVisits.map((visit) => <VisitRow key={visit.id} visit={visit} busyId={busyId} onCancel={cancelVisit} />)}
            {visibleVisits.length === 0 && !loading && <tr><td colSpan={6} className="py-12 text-center text-sm font-bold text-slate-400">Không có lượt khám phù hợp.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VisitRow({ visit, busyId, onCancel }) {
  const patient = visit.patient;
  const room = visit.clinicalRoom;
  const doctor = visit.doctor?.staffProfile;
  const st = getVisitStatus(visit.status);
  const canCancel = visit.status === 'WAITING';
  return (
    <tr className="bg-white hover:bg-slate-50 transition-colors">
      <td className="px-5 py-4 min-w-[240px]"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-50 text-xs font-black text-cyan-700">{patient?.fullName?.slice(0, 2).toUpperCase() || 'BN'}</div><div><p className="text-sm font-black text-slate-900">{patient?.fullName || 'N/A'}</p><p className="text-[11px] font-semibold text-slate-500">{patient?.patientCode || 'N/A'} · {patient?.phone || 'Chưa có SĐT'}</p></div></div></td>
      <td className="px-5 py-4"><span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-mono font-black text-slate-600">{visit.visitCode}</span></td>
      <td className="px-5 py-4 min-w-[220px]"><p className="text-xs font-black text-slate-800">{room?.roomName || 'Chưa có phòng'}</p><p className="text-[11px] font-semibold text-slate-500">BS. {doctor?.fullName || 'Chưa rõ'}</p></td>
      <td className="px-5 py-4"><span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black ${st.color}`}><span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${st.dot}`} />{st.label}</span></td>
      <td className="px-5 py-4 text-xs font-semibold text-slate-500">{visit.createdAt ? new Date(visit.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : 'N/A'}</td>
      <td className="px-5 py-4 text-right">{canCancel ? <button type="button" disabled={busyId === visit.id} onClick={() => onCancel(visit)} className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-black text-red-600 hover:bg-red-100 disabled:opacity-50">{busyId === visit.id ? 'Đang hủy...' : 'Hủy lượt'}</button> : <span className="text-[11px] font-bold text-slate-300">—</span>}</td>
    </tr>
  );
}

function MiniStat({ label, value }) { return <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2"><p className="text-[10px] font-black uppercase text-slate-400">{label}</p><strong className="text-lg font-black text-slate-900">{value}</strong></div>; }

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
      const res = await visitService.search({ limit: 20 });
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
        return [
          visit.visitCode,
          visit.patient?.fullName,
          visit.patient?.patientCode,
          visit.patient?.phone,
          visit.clinicalRoom?.roomName,
          visit.doctor?.staffProfile?.fullName,
        ].filter(Boolean).some((value) => String(value).toLowerCase().includes(text));
      })
      .sort((a, b) => {
        const left = new Date(a.createdAt || a.checkInAt || 0).getTime();
        const right = new Date(b.createdAt || b.checkInAt || 0).getTime();
        return sortOrder === 'asc' ? left - right : right - left;
      });
  }, [query, sortOrder, statusFilter, visits]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-900">Hàng Đợi Lượt Khám</h3>
            <p className="text-[11px] text-slate-500 font-medium">Danh sách bệnh nhân đang xử lý · {visibleVisits.length}/{visits.length} lượt</p>
          </div>
          <button onClick={loadVisits} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors" title="Làm mới">
            {loading ? <LoadingIndicator size="sm" /> : '↻'}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_190px] gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Lọc theo mã lượt, tên BN, phòng, bác sĩ..." className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-50" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 outline-none focus:border-cyan-400">
            <option value="">Tất cả trạng thái</option>
            {Object.entries(VISIT_STATUS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
          </select>
          <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 outline-none focus:border-cyan-400">
            <option value="asc">Sắp xếp: thấp → cao</option>
            <option value="desc">Sắp xếp: cao → thấp</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {visibleVisits.length === 0 && !loading && (
          <div className="text-center py-10 text-slate-400 text-sm">Không có lượt khám phù hợp với bộ lọc.</div>
        )}
        
        {visibleVisits.map(visit => {
          const patient = visit.patient;
          const room = visit.clinicalRoom;
          const doctor = visit.doctor?.staffProfile;
          const st = getVisitStatus(visit.status);
          const canCancel = visit.status === 'WAITING';

          return (
            <div key={visit.id} className="p-4 rounded-xl border border-slate-100 bg-white hover:border-cyan-200 hover:shadow-md hover:shadow-cyan-50 transition-all flex flex-col gap-3 group">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{visit.visitCode}</span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${st.color}`}>{st.label}</span>
                  </div>
                  <h4 className="text-sm font-black text-slate-900 group-hover:text-cyan-700 transition-colors">{patient?.fullName}</h4>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {patient?.patientCode} · {patient?.gender === 'MALE' ? 'Nam' : patient?.gender === 'FEMALE' ? 'Nữ' : 'Khác'} · {patient?.birthDate ? new Date(patient.birthDate).getFullYear() : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 font-bold mb-1">
                    {new Date(visit.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="w-8 h-8 rounded-md bg-cyan-100 text-cyan-700 flex items-center justify-center font-black text-xs shrink-0">
                    {room?.roomCode?.substring(0, 2) || 'RM'}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-slate-700 truncate">{room?.roomName}</p>
                    <p className="text-[10px] text-slate-500 truncate">BS. {doctor?.fullName || 'Chưa rõ'}</p>
                  </div>
                </div>
                {canCancel && (
                  <button
                    type="button"
                    disabled={busyId === visit.id}
                    onClick={() => cancelVisit(visit)}
                    className="shrink-0 rounded-lg border border-red-100 bg-red-50 px-2.5 py-1.5 text-[10px] font-black text-red-600 hover:bg-red-100 disabled:opacity-50"
                  >
                    {busyId === visit.id ? 'Đang hủy...' : 'Hủy lượt'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

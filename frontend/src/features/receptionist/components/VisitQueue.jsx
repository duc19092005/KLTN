import React, { useEffect, useMemo, useState } from 'react';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { visitService } from '../apis/visitService';
import { VISIT_STATUS, getVisitStatus } from '../constants/visitStatus';

const STATUS_TABS = ['', 'WAITING', 'IN_PROGRESS', 'WAITING_TEST_RESULT', 'WAITING_CONCLUSION', 'COMPLETED', 'CANCELLED'];
const PAGE_SIZE = 8;

export default function VisitQueue({ refreshTrigger }) {
  const [visits, setVisits] = useState([]);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState('');

  const loadVisits = async () => {
    setLoading(true);
    try {
      const res = await visitService.search({ limit: 100 });
      const data = res.data;
      const items = Array.isArray(data) ? data : data?.items || [];
      setVisits(items);
      if (selectedVisit) setSelectedVisit(items.find((item) => item.id === selectedVisit.id) || null);
    } catch (err) {
      console.error('Failed to load visits', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadVisits(); }, [refreshTrigger]);
  useEffect(() => { setPage(1); }, [query, statusFilter, sortOrder]);

  const cancelVisit = async (visit) => {
    if (!window.confirm(`Hủy ${visit.visitCode}?`)) return;
    setBusyId(visit.id);
    try {
      await visitService.updateStatus(visit.id, 'CANCELLED');
      await loadVisits();
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể hủy');
    } finally {
      setBusyId('');
    }
  };

  const visibleVisits = useMemo(() => {
    const text = query.trim().toLowerCase();
    return visits
      .filter((visit) => !statusFilter || visit.status === statusFilter)
      .filter((visit) => !text || [visit.visitCode, visit.patient?.fullName, visit.patient?.patientCode, visit.patient?.phone, visit.clinicalRoom?.roomName, visit.doctor?.staffProfile?.fullName, getVisitStatus(visit.status).label].filter(Boolean).some((value) => String(value).toLowerCase().includes(text)))
      .sort((a, b) => {
        const left = new Date(a.createdAt || a.checkInAt || 0).getTime();
        const right = new Date(b.createdAt || b.checkInAt || 0).getTime();
        return sortOrder === 'asc' ? left - right : right - left;
      });
  }, [query, sortOrder, statusFilter, visits]);

  const totalPages = Math.max(1, Math.ceil(visibleVisits.length / PAGE_SIZE));
  const pagedVisits = visibleVisits.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const tabs = useMemo(() => STATUS_TABS.map((status) => ({ status, label: status ? (VISIT_STATUS[status]?.shortLabel || VISIT_STATUS[status]?.label) : 'Tất cả', count: status ? visits.filter((v) => v.status === status).length : visits.length })), [visits]);

  return (
    <>
      <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4 space-y-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div><h3 className="text-lg font-black text-slate-950">Lượt khám</h3><p className="mt-1 text-xs font-semibold text-slate-500">{visibleVisits.length}/{visits.length}</p></div>
            <button type="button" onClick={loadVisits} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 hover:bg-slate-50">{loading ? <LoadingIndicator size="sm" /> : '↻'}</button>
          </div>
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_150px]"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm lượt, BN, phòng..." className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold outline-none focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-50" /><select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-600 outline-none focus:border-cyan-400"><option value="asc">Cũ trước</option><option value="desc">Mới trước</option></select></div>
          <div className="flex gap-2 overflow-x-auto">{tabs.map((tab) => <button key={tab.status || 'ALL'} onClick={() => setStatusFilter(tab.status)} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black whitespace-nowrap ${statusFilter === tab.status ? 'border-cyan-600 bg-cyan-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}><span>{tab.label}</span><span className={`rounded-full px-2 py-0.5 text-[10px] ${statusFilter === tab.status ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{tab.count}</span></button>)}</div>
        </div>

        {visibleVisits.length > 0 ? <>
          <div className="hidden overflow-x-auto lg:block"><table className="min-w-full text-left"><thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Bệnh nhân</th><th className="px-5 py-3">Mã lượt</th><th className="px-5 py-3">Phòng / BS</th><th className="px-5 py-3">Trạng thái</th><th className="px-5 py-3">Giờ</th><th className="px-5 py-3 text-right">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">{pagedVisits.map((visit) => <VisitRow key={visit.id} visit={visit} onOpen={() => setSelectedVisit(visit)} />)}</tbody></table></div>
          <div className="space-y-3 p-4 lg:hidden">{pagedVisits.map((visit) => <VisitCard key={visit.id} visit={visit} onOpen={() => setSelectedVisit(visit)} />)}</div>
          <Pagination page={page} totalPages={totalPages} total={visibleVisits.length} onPrev={() => setPage((v) => Math.max(1, v - 1))} onNext={() => setPage((v) => Math.min(totalPages, v + 1))} />
        </> : !loading && <div className="p-12 text-center text-sm font-bold text-slate-400">Không có dữ liệu</div>}
      </div>

      {selectedVisit && <VisitDetailModal visit={selectedVisit} busyId={busyId} onCancel={cancelVisit} onClose={() => setSelectedVisit(null)} />}
    </>
  );
}

function VisitRow({ visit, onOpen }) {
  const patient = visit.patient; const room = visit.clinicalRoom; const doctor = visit.doctor?.staffProfile; const st = getVisitStatus(visit.status);
  return <tr onClick={onOpen} className="cursor-pointer bg-white hover:bg-cyan-50/40"><td className="px-5 py-4 min-w-[240px]"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-50 text-xs font-black text-cyan-700">{patient?.fullName?.slice(0, 2).toUpperCase() || 'BN'}</div><div><p className="text-sm font-black text-slate-900">{patient?.fullName || 'N/A'}</p><p className="text-[11px] font-semibold text-slate-500">{patient?.patientCode || 'N/A'} · {patient?.phone || 'Chưa có SĐT'}</p></div></div></td><td className="px-5 py-4"><span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-mono font-black text-slate-600">{visit.visitCode}</span></td><td className="px-5 py-4 min-w-[220px]"><p className="text-xs font-black text-slate-800">{room?.roomName || 'Chưa có phòng'}</p><p className="text-[11px] font-semibold text-slate-500">BS. {doctor?.fullName || 'Chưa rõ'}</p></td><td className="px-5 py-4"><StatusBadge st={st} /></td><td className="px-5 py-4 text-xs font-semibold text-slate-500">{visit.createdAt ? new Date(visit.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : 'N/A'}</td><td className="px-5 py-4 text-right"><button type="button" onClick={(event) => { event.stopPropagation(); onOpen(); }} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50">Chi tiết</button></td></tr>;
}
function VisitCard({ visit, onOpen }) { const st = getVisitStatus(visit.status); return <button type="button" onClick={onOpen} className="w-full rounded-2xl border border-slate-100 bg-white p-4 text-left hover:bg-cyan-50/40"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-black text-slate-900">{visit.patient?.fullName || 'N/A'}</p><p className="text-xs font-semibold text-slate-500">{visit.visitCode} · {visit.clinicalRoom?.roomName || 'Chưa có phòng'}</p></div><StatusBadge st={st} /></div></button>; }
function VisitDetailModal({ visit, busyId, onCancel, onClose }) { const st = getVisitStatus(visit.status); const canCancel = visit.status === 'WAITING'; useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = 'unset'; }; }, []); return <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"><div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} /><div className="relative w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl"><div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5"><div><div className="mb-2 flex flex-wrap items-center gap-2"><span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-mono font-black text-slate-700">{visit.visitCode}</span><StatusBadge st={st} /></div><h2 className="text-2xl font-black text-slate-950">{visit.patient?.fullName || 'N/A'}</h2><p className="mt-1 text-sm font-bold text-slate-500">{visit.patient?.patientCode || 'N/A'}</p></div><button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">×</button></div><div className="grid gap-3 p-5 sm:grid-cols-2"><Info label="SĐT" value={visit.patient?.phone || 'Chưa có'} /><Info label="Phòng" value={visit.clinicalRoom?.roomName || 'Chưa có phòng'} /><Info label="Bác sĩ" value={`BS. ${visit.doctor?.staffProfile?.fullName || 'Chưa rõ'}`} /><Info label="Giờ tạo" value={visit.createdAt ? new Date(visit.createdAt).toLocaleString('vi-VN') : 'N/A'} /></div>{canCancel && <div className="border-t border-slate-100 p-5 text-right"><button disabled={busyId === visit.id} onClick={() => onCancel(visit)} className="rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-xs font-black text-red-600 hover:bg-red-100 disabled:opacity-50">{busyId === visit.id ? 'Đang hủy...' : 'Hủy lượt'}</button></div>}</div></div>; }
function Info({ label, value }) { return <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 text-sm font-bold text-slate-900 break-words">{value}</p></div>; }
function Pagination({ page, totalPages, total, onPrev, onNext }) { return <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs font-bold text-slate-500">Trang {page}/{totalPages} · {total} lượt</p><div className="flex gap-2"><button onClick={onPrev} disabled={page <= 1} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black text-slate-600 disabled:opacity-40">Trước</button><button onClick={onNext} disabled={page >= totalPages} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black text-slate-600 disabled:opacity-40">Sau</button></div></div>; }
function StatusBadge({ st }) { return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-black ${st.color}`}><span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${st.dot}`} />{st.shortLabel || st.label}</span>; }

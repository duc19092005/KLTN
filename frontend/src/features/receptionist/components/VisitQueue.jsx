import React, { useEffect, useMemo, useState } from 'react';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { visitService } from '../apis/visitService';
import { VISIT_STATUS, getVisitStatus } from '../constants/visitStatus';
import { useToast } from '../../../providers/ToastProvider';

const STATUS_TABS = ['', 'WAITING', 'IN_PROGRESS', 'WAITING_TEST_RESULT', 'WAITING_CONCLUSION', 'COMPLETED', 'CANCELLED'];
const PAGE_SIZE = 8;

function getVisitDepartmentName(visit) {
  return visit.department?.name || visit.department?.departmentCode || 'Chưa có phòng';
}

function getVisitStaffName(visit) {
  return visit.staff?.fullName || visit.staff?.user?.username || 'Chưa phân công';
}

function getVisitTime(visit) {
  return visit.checkInAt || visit.createdAt;
}

export default function VisitQueue({ refreshTrigger }) {
  const [visits, setVisits] = useState([]);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState('');
  const toast = useToast();

  const loadVisits = async () => {
    setLoading(true);
    try {
      const res = await visitService.search({ limit: 100 });
      const data = res.data;
      const items = Array.isArray(data) ? data : data?.items || [];
      setVisits(items);
      if (selectedVisit) setSelectedVisit(items.find((item) => item.id === selectedVisit.id) || null);
    } catch (err) {
      toast.error('Không tải được danh sách lượt khám');
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
      toast.success(`Đã hủy lượt khám ${visit.visitCode} thành công!`);
      await loadVisits();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không thể hủy');
    } finally {
      setBusyId('');
    }
  };

  const visibleVisits = useMemo(() => {
    const text = query.trim().toLowerCase();
    return visits
      .filter((visit) => !statusFilter || visit.status === statusFilter)
      .filter((visit) => !text || [
        visit.visitCode,
        visit.patient?.fullName,
        visit.patient?.patientCode,
        visit.patient?.phone,
        getVisitDepartmentName(visit),
        getVisitStaffName(visit),
        getVisitStatus(visit.status).label,
      ].filter(Boolean).some((value) => String(value).toLowerCase().includes(text)))
      .sort((a, b) => {
        const left = new Date(getVisitTime(a) || 0).getTime();
        const right = new Date(getVisitTime(b) || 0).getTime();
        return sortOrder === 'asc' ? left - right : right - left;
      });
  }, [query, sortOrder, statusFilter, visits]);

  const totalPages = Math.max(1, Math.ceil(visibleVisits.length / PAGE_SIZE));
  const pagedVisits = visibleVisits.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const tabs = useMemo(() => STATUS_TABS.map((status) => ({
    status,
    label: status ? (VISIT_STATUS[status]?.shortLabel || VISIT_STATUS[status]?.label) : 'Tất cả',
    count: status ? visits.filter((visit) => visit.status === status).length : visits.length,
  })), [visits]);

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-600">Quản lý hàng đợi</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">Danh sách lượt khám</h2>
              <p className="mt-1 text-xs font-semibold text-slate-500">Hiển thị {visibleVisits.length}/{visits.length} lượt khám</p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(260px,1fr)_160px_auto] xl:min-w-[680px]">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm mã lượt, bệnh nhân, SĐT, phòng khám..."
                className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-50"
              />
              <select
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
                className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-50"
              >
                <option value="asc">Cũ trước</option>
                <option value="desc">Mới trước</option>
              </select>
              <button type="button" onClick={loadVisits} className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 hover:bg-slate-50">
                {loading ? <LoadingIndicator size="sm" /> : 'Làm mới'}
              </button>
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {tabs.map((tab) => (
              <button
                key={tab.status || 'ALL'}
                type="button"
                onClick={() => setStatusFilter(tab.status)}
                className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xl border px-3.5 py-2 text-xs font-black transition-colors ${statusFilter === tab.status ? 'border-cyan-600 bg-cyan-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                <span>{tab.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] ${statusFilter === tab.status ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{tab.count}</span>
              </button>
            ))}
          </div>
        </div>

        {visibleVisits.length > 0 ? (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="ui-table min-w-full text-left">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Bệnh nhân</th>
                    <th className="px-5 py-3">Mã lượt</th>
                    <th className="px-5 py-3">Phòng / bác sĩ</th>
                    <th className="px-5 py-3">Trạng thái</th>
                    <th className="px-5 py-3">Giờ</th>
                    <th className="px-5 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedVisits.map((visit) => <VisitRow key={visit.id} visit={visit} onOpen={() => setSelectedVisit(visit)} />)}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 p-4 lg:hidden">
              {pagedVisits.map((visit) => <VisitCard key={visit.id} visit={visit} onOpen={() => setSelectedVisit(visit)} />)}
            </div>
            <Pagination page={page} totalPages={totalPages} total={visibleVisits.length} onPrev={() => setPage((value) => Math.max(1, value - 1))} onNext={() => setPage((value) => Math.min(totalPages, value + 1))} />
          </>
        ) : !loading && <EmptyState />}
      </section>

      {selectedVisit && <VisitDetailModal visit={selectedVisit} busyId={busyId} onCancel={cancelVisit} onClose={() => setSelectedVisit(null)} />}
    </>
  );
}

function VisitRow({ visit, onOpen }) {
  const patient = visit.patient;
  const status = getVisitStatus(visit.status);
  return (
    <tr className="bg-white transition-colors hover:bg-slate-50">
      <td className="min-w-[260px] px-5 py-4">
        <PatientIdentity patient={patient} />
      </td>
      <td className="px-5 py-4">
        <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-mono font-black text-slate-600">{visit.visitCode}</span>
      </td>
      <td className="min-w-[240px] px-5 py-4">
        <p className="text-xs font-black text-slate-800">{getVisitDepartmentName(visit)}</p>
        <p className="mt-0.5 text-[11px] font-semibold text-slate-500">BS. {getVisitStaffName(visit)}</p>
      </td>
      <td className="px-5 py-4"><StatusBadge status={status} /></td>
      <td className="px-5 py-4 text-xs font-semibold text-slate-500">
        {getVisitTime(visit) ? new Date(getVisitTime(visit)).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : 'N/A'}
      </td>
      <td className="px-5 py-4 text-right">
        <button type="button" onClick={onOpen} className="rounded-xl border border-cyan-100 bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-700 hover:bg-cyan-100">Chi tiết</button>
      </td>
    </tr>
  );
}

function VisitCard({ visit, onOpen }) {
  const status = getVisitStatus(visit.status);
  return (
    <article className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <PatientIdentity patient={visit.patient} />
        <StatusBadge status={status} />
      </div>
      <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs font-semibold text-slate-500">
        <p><span className="font-black text-slate-700">Mã lượt:</span> {visit.visitCode}</p>
        <p className="mt-1"><span className="font-black text-slate-700">Phòng:</span> {getVisitDepartmentName(visit)}</p>
      </div>
      <button type="button" onClick={onOpen} className="mt-3 w-full rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-black text-white hover:bg-cyan-700">Chi tiết</button>
    </article>
  );
}

function VisitDetailModal({ visit, busyId, onCancel, onClose }) {
  const status = getVisitStatus(visit.status);
  const canCancel = visit.status === 'WAITING';

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-mono font-black text-slate-700">{visit.visitCode}</span>
              <StatusBadge status={status} />
            </div>
            <h2 className="text-2xl font-black text-slate-950">{visit.patient?.fullName || 'N/A'}</h2>
            <p className="mt-1 text-sm font-bold text-slate-500">{visit.patient?.patientCode || 'N/A'}</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">×</button>
        </header>

        <div className="grid flex-1 gap-5 overflow-y-auto p-5 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="space-y-3">
            <Info label="SĐT" value={visit.patient?.phone || 'Chưa có'} />
            <Info label="Mã bệnh nhân" value={visit.patient?.patientCode || 'N/A'} />
            <Info label="Giờ tiếp nhận" value={getVisitTime(visit) ? new Date(getVisitTime(visit)).toLocaleString('vi-VN') : 'N/A'} />
          </section>
          <section className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-600">Điều phối khám</p>
            <h3 className="mt-1 text-lg font-black text-slate-950">Phòng khám & bác sĩ</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Info label="Phòng" value={getVisitDepartmentName(visit)} />
              <Info label="Bác sĩ" value={`BS. ${getVisitStaffName(visit)}`} />
              <Info label="Nguồn" value={visit.source === 'APPOINTMENT' ? 'Lịch hẹn' : 'Trực tiếp'} />
              <Info label="Trạng thái" value={status.label} />
            </div>
          </section>
        </div>

        {canCancel && (
          <footer className="border-t border-slate-100 p-5 text-right">
            <button disabled={busyId === visit.id} onClick={() => onCancel(visit)} className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-2.5 text-xs font-black text-rose-600 hover:bg-rose-100 disabled:opacity-50">
              {busyId === visit.id ? 'Đang hủy...' : 'Hủy lượt'}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}

function PatientIdentity({ patient }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-cyan-50 text-xs font-black text-cyan-700">{patient?.fullName?.slice(0, 2).toUpperCase() || 'BN'}</div>
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-slate-900">{patient?.fullName || 'N/A'}</p>
        <p className="text-[11px] font-semibold text-slate-500">{patient?.patientCode || 'N/A'} · {patient?.phone || 'Chưa có SĐT'}</p>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-slate-900">{value}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="p-12 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-50 text-lg font-black text-slate-300">∅</div>
      <p className="mt-3 text-sm font-black text-slate-600">Không có dữ liệu</p>
      <p className="mt-1 text-xs font-semibold text-slate-400">Thử đổi bộ lọc hoặc làm mới danh sách.</p>
    </div>
  );
}

function Pagination({ page, totalPages, total, onPrev, onNext }) {
  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs font-bold text-slate-500">Trang {page}/{totalPages} · {total} lượt</p>
      <div className="flex gap-2">
        <button type="button" onClick={onPrev} disabled={page <= 1} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black text-slate-600 disabled:opacity-40">Trước</button>
        <button type="button" onClick={onNext} disabled={page >= totalPages} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black text-slate-600 disabled:opacity-40">Sau</button>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-black ${status.color}`}>
      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${status.dot}`} />
      {status.shortLabel || status.label}
    </span>
  );
}

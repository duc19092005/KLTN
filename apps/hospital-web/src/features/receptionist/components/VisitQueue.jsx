import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { visitService } from '../apis/visitService';
import { VISIT_STATUS, getVisitStatus } from '../constants/visitStatus';
import { useToast } from '../../../providers/ToastProvider';
import { Search, Filter, RefreshCw, X, User, Building2, Stethoscope, Clock, AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';

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
    label: status ? (VISIT_STATUS[status]?.shortLabel || VISIT_STATUS[status]?.label) : 'Tất cả lượt',
    count: status ? visits.filter((visit) => visit.status === status).length : visits.length,
  })), [visits]);

  return (
    <>
      <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm antialiased">
        {/* HEADER FILTERS & STATUS TABS */}
        <div className="border-b border-slate-100 p-6 space-y-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-sky-600">
                Điều phối bệnh nhân
              </p>
              <h2 className="text-lg font-bold text-slate-900">
                Danh sách lượt khám trong ngày
              </h2>
              <p className="mt-0.5 text-xs font-semibold text-slate-400">
                Hiển thị {visibleVisits.length} trên tổng số {visits.length} lượt khám
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(260px,1fr)_160px_auto] xl:min-w-[640px]">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Tìm mã lượt, tên bệnh nhân, SĐT, phòng khám..."
                  className="h-11 w-full pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                />
              </div>

              <select
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              >
                <option value="asc">Thời gian: Cũ trước</option>
                <option value="desc">Thời gian: Mới trước</option>
              </select>

              <button
                type="button"
                onClick={loadVisits}
                className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-2 transition-colors"
              >
                {loading ? <LoadingIndicator size="sm" /> : <RefreshCw className="w-4 h-4 text-slate-400" />}
              </button>
            </div>
          </div>

          {/* STATUS PILL TABS */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {tabs.map((tab) => (
              <button
                key={tab.status || 'ALL'}
                type="button"
                onClick={() => setStatusFilter(tab.status)}
                className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xl border px-3.5 py-2 text-xs font-bold transition-all ${
                  statusFilter === tab.status
                    ? 'border-sky-600 bg-sky-600 text-white shadow-xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                    statusFilter === tab.status ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* VISITS TABLE FOR DESKTOP */}
        {visibleVisits.length > 0 ? (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="ui-table min-w-full text-left">
                <thead className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-6 py-3.5">Bệnh nhân</th>
                    <th className="px-6 py-3.5">Mã lượt</th>
                    <th className="px-6 py-3.5">Phòng khám / Bác sĩ</th>
                    <th className="px-6 py-3.5">Trạng thái</th>
                    <th className="px-6 py-3.5">Giờ tiếp nhận</th>
                    <th className="px-6 py-3.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedVisits.map((visit) => (
                    <VisitRow key={visit.id} visit={visit} onOpen={() => setSelectedVisit(visit)} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* CARDS FOR MOBILE */}
            <div className="space-y-3 p-4 lg:hidden">
              {pagedVisits.map((visit) => (
                <VisitCard key={visit.id} visit={visit} onOpen={() => setSelectedVisit(visit)} />
              ))}
            </div>

            {/* PAGINATION */}
            <Pagination
              page={page}
              totalPages={totalPages}
              total={visibleVisits.length}
              onPrev={() => setPage((value) => Math.max(1, value - 1))}
              onNext={() => setPage((value) => Math.min(totalPages, value + 1))}
            />
          </>
        ) : !loading && <EmptyState />}
      </section>

      {/* DETAIL MODAL */}
      {selectedVisit && (
        <VisitDetailModal
          visit={selectedVisit}
          busyId={busyId}
          onCancel={cancelVisit}
          onClose={() => setSelectedVisit(null)}
        />
      )}
    </>
  );
}

function VisitRow({ visit, onOpen }) {
  const patient = visit.patient;
  const status = getVisitStatus(visit.status);
  return (
    <tr className="bg-white transition-colors hover:bg-sky-50/30">
      <td className="min-w-[260px] px-6 py-4">
        <PatientIdentity patient={patient} />
      </td>
      <td className="px-6 py-4">
        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-mono font-bold text-slate-700 border border-slate-200/60">
          {visit.visitCode}
        </span>
      </td>
      <td className="min-w-[240px] px-6 py-4">
        <p className="text-xs font-bold text-slate-900">{getVisitDepartmentName(visit)}</p>
        <p className="mt-0.5 text-[11px] font-semibold text-slate-500">BS. {getVisitStaffName(visit)}</p>
      </td>
      <td className="px-6 py-4">
        <StatusBadge status={status} />
      </td>
      <td className="px-6 py-4 text-xs font-medium text-slate-500">
        {getVisitTime(visit)
          ? new Date(getVisitTime(visit)).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
          : 'N/A'}
      </td>
      <td className="px-6 py-4 text-right">
        <button
          type="button"
          onClick={onOpen}
          className="rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-1.5 text-xs font-bold text-sky-700 hover:bg-sky-100 transition-colors"
        >
          Chi tiết
        </button>
      </td>
    </tr>
  );
}

function VisitCard({ visit, onOpen }) {
  const status = getVisitStatus(visit.status);
  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-3">
        <PatientIdentity patient={visit.patient} />
        <StatusBadge status={status} />
      </div>
      <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-xs font-semibold text-slate-600 space-y-1">
        <p><span className="font-bold text-slate-800">Mã lượt:</span> {visit.visitCode}</p>
        <p><span className="font-bold text-slate-800">Phòng khám:</span> {getVisitDepartmentName(visit)}</p>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="w-full rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-sky-700 transition-colors"
      >
        Xem chi tiết lượt khám
      </button>
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

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 antialiased">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-[1000px] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl animate-fadeIn">
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 p-6">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-mono font-bold text-slate-700">
                {visit.visitCode}
              </span>
              <StatusBadge status={status} />
            </div>
            <h2 className="text-xl font-bold text-slate-900">{visit.patient?.fullName || 'N/A'}</h2>
            <p className="mt-0.5 text-xs font-semibold text-sky-600">Mã bệnh nhân: {visit.patient?.patientCode || 'N/A'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 grid place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors text-lg"
          >
            ×
          </button>
        </header>

        <div className="grid flex-1 gap-6 overflow-y-auto p-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="space-y-3">
            <Info label="Số điện thoại" value={visit.patient?.phone || 'Chưa có SĐT'} />
            <Info label="Mã bệnh nhân" value={visit.patient?.patientCode || 'N/A'} />
            <Info
              label="Thời gian tiếp nhận"
              value={getVisitTime(visit) ? new Date(getVisitTime(visit)).toLocaleString('vi-VN') : 'N/A'}
            />
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-5 space-y-4">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-sky-600">Điều phối khám</p>
              <h3 className="mt-0.5 text-base font-bold text-slate-900">Phòng khám & Bác sĩ tiếp nhận</h3>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Phòng khám" value={getVisitDepartmentName(visit)} />
              <Info label="Bác sĩ" value={`BS. ${getVisitStaffName(visit)}`} />
              <Info label="Nguồn đăng ký" value={visit.source === 'APPOINTMENT' ? 'Lịch hẹn trước' : 'Đăng ký trực tiếp'} />
              <Info label="Trạng thái" value={status.label} />
            </div>
          </section>
        </div>

        {canCancel && (
          <footer className="border-t border-slate-100 p-5 flex items-center justify-end">
            <button
              disabled={busyId === visit.id}
              onClick={() => onCancel(visit)}
              className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-100 disabled:opacity-50 transition-colors"
            >
              {busyId === visit.id ? 'Đang hủy...' : 'Hủy lượt khám này'}
            </button>
          </footer>
        )}
      </div>
    </div>,
    document.body
  );
}

function PatientIdentity({ patient }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="w-10 h-10 shrink-0 rounded-2xl bg-sky-100 text-sky-700 font-bold text-xs flex items-center justify-center border border-sky-200">
        {patient?.fullName?.slice(0, 2).toUpperCase() || 'BN'}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-bold text-slate-900">{patient?.fullName || 'N/A'}</p>
        <p className="text-[11px] font-medium text-slate-500">
          {patient?.patientCode || 'N/A'} • {patient?.phone || 'Chưa có SĐT'}
        </p>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
      <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-0.5 break-words text-xs font-bold text-slate-900">{value}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="p-12 text-center">
      <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 grid place-items-center mx-auto mb-3">
        <Filter className="w-6 h-6 stroke-[1.75]" />
      </div>
      <p className="text-sm font-bold text-slate-700">Không tìm thấy lượt khám phù hợp</p>
      <p className="text-xs font-medium text-slate-400 mt-1">Thử đổi từ khóa tìm kiếm hoặc chọn bộ lọc trạng thái khác.</p>
    </div>
  );
}

function Pagination({ page, totalPages, total, onPrev, onNext }) {
  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs font-bold text-slate-500">
        Trang {page} / {totalPages} • Tổng số {total} lượt khám
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={page <= 1}
          className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
        >
          Trang trước
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={page >= totalPages}
          className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
        >
          Trang sau
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${status.color}`}>
      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${status.dot}`} />
      {status.shortLabel || status.label}
    </span>
  );
}

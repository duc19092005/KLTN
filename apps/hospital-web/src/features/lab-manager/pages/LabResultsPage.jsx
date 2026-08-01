import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { medicalOrderService } from '../../medical-order/apis/medicalOrderService';
import { LAB_MANAGER_NAV_ITEMS, labManagerRouteFor } from '../constants/navigation';
import { getMedicalOrderStatus } from '../constants/medicalOrderStatus';
import { useToast } from '../../../providers/ToastProvider';
import { FileCheck2, Search, Download, FileText, ArrowRight, Filter } from 'lucide-react';

function getItems(data) { return Array.isArray(data) ? data : data?.items || []; }

export default function LabResultsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedResult, setSelectedResult] = useState(null);

  const openResultFile = async (fileId) => {
    try {
      const dl = await medicalOrderService.getResultFileDownloadUrl(fileId);
      if (dl.data?.url) window.open(dl.data.url, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error('Không tải được tệp kết quả hoặc bạn không có quyền truy cập.');
    }
  };

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const res = await medicalOrderService.list({ status: 'RESULT_READY' });
        if (mounted) setOrders(getItems(res.data));
      } catch (err) {
        if (mounted) toast.error(err.response?.data?.message || 'Không tải được kết quả');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const results = useMemo(() => orders.flatMap((order) => (order.results || []).map((result) => ({ ...result, order }))), [orders]);
  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return results;
    return results.filter((result) => [
      result.resultCode,
      result.note,
      result.order?.orderCode,
      result.order?.orderType,
      result.order?.patient?.fullName,
      result.order?.patient?.patientCode,
    ].filter(Boolean).some((value) => String(value).toLowerCase().includes(text)));
  }, [query, results]);

  return (
    <DashboardLayout user={user} navItems={LAB_MANAGER_NAV_ITEMS} activeItem="results" onNavigate={(id) => navigate(labManagerRouteFor(id))} onLogout={logout}>
      <div className="mx-auto max-w-[1600px] space-y-6 antialiased pb-12">
        {/* HERO BANNER */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-emerald-50/80 blur-2xl pointer-events-none" />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/25 shrink-0">
                <FileCheck2 className="w-6 h-6" strokeWidth={2} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-100">
                    Kho lưu trữ
                  </span>
                  <span className="text-xs font-semibold text-slate-400">• Kết quả cận lâm sàng</span>
                </div>
                <h1 className="mt-1 text-2xl font-bold text-slate-900 tracking-tight">
                  Lịch sử & Kho kết quả cận lâm sàng
                </h1>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('/lab-manager/orders')}
              className="w-fit rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
            >
              Xem danh sách phiếu chỉ định
            </button>
          </div>
        </section>

        {/* SEARCH & RESULTS TABLE */}
        <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
          <div className="space-y-4 border-b border-slate-100 p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Danh sách kết quả đã trả về cho Bác sĩ</h2>
                <p className="mt-0.5 text-xs font-semibold text-slate-400">
                  Hiển thị {filtered.length} bản ghi kết quả hoàn tất
                </p>
              </div>
              <span className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-xs font-bold text-emerald-700">
                {filtered.length} kết quả
              </span>
            </div>

            <div className="relative max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm mã kết quả, tên bệnh nhân, loại chỉ định..."
                className="h-11 w-full pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
              />
            </div>
          </div>

          <div>
            {loading ? (
              <div className="py-16"><LoadingIndicator size="lg" label="Đang tải kết quả..." /></div>
            ) : filtered.length > 0 ? (
              <ResultList results={filtered} onOpen={setSelectedResult} />
            ) : (
              <Empty title="Chưa có dữ liệu kết quả" />
            )}
          </div>
        </section>
      </div>

      {/* DETAIL MODAL */}
      {selectedResult && (
        <ResultModal
          result={selectedResult}
          onOpenFile={openResultFile}
          onClose={() => setSelectedResult(null)}
        />
      )}
    </DashboardLayout>
  );
}

function ResultList({ results, onOpen }) {
  return (
    <div className="overflow-x-auto">
      <table className="ui-table min-w-full text-left">
        <thead className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-6 py-3.5">Mã kết quả</th>
            <th className="px-6 py-3.5">Bệnh nhân</th>
            <th className="px-6 py-3.5">Loại chỉ định</th>
            <th className="px-6 py-3.5">Số lượng tệp</th>
            <th className="px-6 py-3.5 text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {results.map((result) => (
            <ResultRow key={result.id} result={result} onClick={() => onOpen(result)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResultRow({ result, onClick }) {
  const patientName = result.order?.patient?.fullName || 'Chưa có tên';
  return (
    <tr className="bg-white transition-colors hover:bg-emerald-50/20">
      <td className="whitespace-nowrap px-6 py-4">
        <strong className="rounded-lg bg-emerald-50 px-2.5 py-1 font-mono text-xs font-bold text-emerald-800 border border-emerald-200/60">
          {result.resultCode || 'Chưa có mã'}
        </strong>
        <p className="mt-1 text-[11px] font-medium text-slate-400">{formatDate(result.createdAt)}</p>
      </td>
      <td className="min-w-[240px] px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 shrink-0 rounded-2xl bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center border border-emerald-200">
            {patientName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-slate-900">{patientName}</p>
            <p className="text-[11px] font-medium text-slate-500">{result.order?.patient?.patientCode || 'N/A'}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <p className="text-xs font-bold text-slate-800">{result.order?.orderType || 'CLS'}</p>
        <div className="mt-1">
          <StatusBadge status={result.order?.status} />
        </div>
      </td>
      <td className="whitespace-nowrap px-6 py-4 text-xs font-bold text-emerald-700">
        {result.files?.length || 0} tệp đính kèm
      </td>
      <td className="px-6 py-4 text-right">
        <button
          type="button"
          onClick={onClick}
          className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
        >
          Xem chi tiết
        </button>
      </td>
    </tr>
  );
}

function ResultModal({ result, onOpenFile, onClose }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  const files = result.files || [];
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 antialiased">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-[1100px] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl animate-fadeIn">
        {/* MODAL HEADER */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-mono font-bold text-emerald-700 border border-emerald-200">
                {result.resultCode || 'Chưa có mã'}
              </span>
              <StatusBadge status={result.order?.status} />
            </div>
            <h2 className="mt-2 text-xl font-bold text-slate-900">{result.order?.orderType || 'Kết quả CLS'}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 grid place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors text-lg"
          >
            ×
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="grid flex-1 gap-6 overflow-y-auto bg-slate-50/50 p-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="space-y-3">
            <InfoCard label="Bệnh nhân" value={`${result.order?.patient?.fullName || 'Chưa có tên'} • Mã BN: ${result.order?.patient?.patientCode || 'N/A'}`} />
            <InfoCard label="Phiếu chỉ định" value={result.order?.orderCode || 'Chưa có mã phiếu'} />
            <InfoCard label="Nhận xét / Kết luận kỹ thuật viên" value={result.note || 'Không có nhận xét'} />
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-4">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600">Tệp đính kèm</p>
              <h3 className="text-base font-bold text-slate-900">Danh sách tệp kết quả ({files.length})</h3>
            </div>

            {files.length ? (
              <div className="space-y-2">
                {files.map((file, index) => (
                  <button
                    key={file.id || `${file.originalName}-${index}`}
                    type="button"
                    onClick={() => onOpenFile(file.id)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 text-left text-xs font-bold text-slate-800 border border-slate-200/80 hover:bg-emerald-50 hover:border-emerald-200 transition-all shadow-xs"
                  >
                    <span className="min-w-0 truncate">{file.originalName || file.fileName || 'Tệp kết quả'}</span>
                    <span className="shrink-0 text-slate-400 font-medium flex items-center gap-1.5">
                      <Download className="w-3.5 h-3.5 text-emerald-600" />
                      {formatFileSize(file.size)}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs font-medium text-slate-500 py-6 text-center bg-slate-50 rounded-xl">Chưa có tệp kết quả nào được đính kèm.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const st = getMedicalOrderStatus(status);
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${st.color}`}>
      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${st.dot}`} />
      {st.shortLabel}
    </span>
  );
}

function InfoCard({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
      <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-0.5 break-words text-xs font-bold text-slate-900">{value}</p>
    </div>
  );
}

function Empty({ title }) {
  return (
    <div className="p-12 text-center">
      <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 grid place-items-center mx-auto mb-3">
        <Filter className="w-6 h-6 stroke-[1.75]" />
      </div>
      <p className="text-sm font-bold text-slate-700">{title}</p>
      <p className="text-xs font-medium text-slate-400 mt-1">Thử đổi từ khóa tìm kiếm hoặc kiểm tra lại kho kết quả.</p>
    </div>
  );
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : 'Chưa cập nhật';
}

function formatFileSize(bytes = 0) {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

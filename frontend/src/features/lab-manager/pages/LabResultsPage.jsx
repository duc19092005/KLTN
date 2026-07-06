import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { medicalOrderService } from '../../medical-order/apis/medicalOrderService';
import { LAB_MANAGER_NAV_ITEMS, labManagerRouteFor } from '../constants/navigation';
import { getMedicalOrderStatus } from '../constants/medicalOrderStatus';
import { useToast } from '../../../providers/ToastProvider';

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
      <div className="mx-auto max-w-7xl space-y-5 pb-12">
        <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="space-y-4 border-b border-slate-100 p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-lg font-black text-slate-950">Kết quả cận lâm sàng</h1>
              </div>
              <button type="button" onClick={() => navigate('/lab-manager/orders')} className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700 shadow-sm hover:bg-slate-50">Phiếu CLS</button>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(280px,1fr)_auto]">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm mã kết quả, bệnh nhân, phiếu chỉ định..." className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-50" />
              <span className="w-fit rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1.5 text-xs font-black text-cyan-700">{filtered.length} kết quả</span>
            </div>
          </div>

          <div className="p-5">
            {loading ? (
              <div className="py-16"><LoadingIndicator size="lg" label="Đang tải kết quả..." /></div>
            ) : filtered.length > 0 ? (
              <ResultList results={filtered} onOpen={setSelectedResult} />
            ) : (
              <Empty title="Không có dữ liệu" />
            )}
          </div>
        </section>
      </div>
      {selectedResult && <ResultModal result={selectedResult} onOpenFile={openResultFile} onClose={() => setSelectedResult(null)} />}
    </DashboardLayout>
  );
}

function ResultList({ results, onOpen }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100">
      <table className="ui-table min-w-full text-left">
        <thead className="border-b border-slate-100 bg-slate-50">
          <tr className="text-[11px] font-black uppercase tracking-wider text-slate-500">
            <th className="px-5 py-3">Kết quả</th>
            <th className="px-5 py-3">Bệnh nhân</th>
            <th className="px-5 py-3">Chỉ định</th>
            <th className="px-5 py-3">Tệp</th>
            <th className="px-5 py-3 text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {results.map((result) => <ResultRow key={result.id} result={result} onClick={() => onOpen(result)} />)}
        </tbody>
      </table>
    </div>
  );
}

function ResultRow({ result, onClick }) {
  const patientName = result.order?.patient?.fullName || 'Chưa có tên';
  return (
    <tr className="bg-white transition-colors hover:bg-slate-50">
      <td className="whitespace-nowrap px-5 py-4"><strong className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-[11px] font-black text-slate-700">{result.resultCode || 'Chưa có mã'}</strong><p className="mt-2 text-[11px] font-semibold text-slate-500">{formatDate(result.createdAt)}</p></td>
      <td className="min-w-[240px] px-5 py-4"><div className="flex items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-cyan-50 text-xs font-black text-cyan-700 ring-1 ring-cyan-100">{patientName.slice(0, 2).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm font-black text-slate-900">{patientName}</p><p className="text-xs font-semibold text-slate-500">{result.order?.patient?.patientCode || 'Chưa có mã BN'}</p></div></div></td>
      <td className="px-5 py-4"><p className="text-sm font-black text-slate-800">{result.order?.orderType || 'CLS'}</p><div className="mt-1"><StatusBadge status={result.order?.status} /></div></td>
      <td className="whitespace-nowrap px-5 py-4 text-xs font-black text-cyan-700">{result.files?.length || 0} tệp</td>
      <td className="px-5 py-4 text-right"><button type="button" onClick={onClick} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50">Chi tiết</button></td>
    </tr>
  );
}

function ResultModal({ result, onOpenFile, onClose }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  const files = result.files || [];
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div>
            <div className="flex flex-wrap gap-2"><span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">{result.resultCode || 'Chưa có mã'}</span><StatusBadge status={result.order?.status} /></div>
            <h2 className="mt-2 text-xl font-black text-slate-950">{result.order?.orderType || 'Kết quả CLS'}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-black text-slate-600 hover:bg-slate-50">Đóng</button>
        </div>
        <div className="grid flex-1 gap-5 overflow-y-auto bg-slate-50/70 p-5 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="space-y-3">
            <InfoCard label="Bệnh nhân" value={`${result.order?.patient?.fullName || 'Chưa có tên'} · ${result.order?.patient?.patientCode || 'Chưa có mã BN'}`} />
            <InfoCard label="Phiếu chỉ định" value={result.order?.orderCode || 'Chưa có mã phiếu'} />
            <InfoCard label="Nhận xét / kết luận" value={result.note || 'Không có nhận xét'} />
          </section>
          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">Tệp kết quả</p>
            <h3 className="mt-1 text-lg font-black text-slate-950">Danh sách tệp đã trả</h3>
            {files.length ? (
              <div className="mt-4 space-y-2">
                {files.map((file, index) => (
                  <button key={file.id || `${file.originalName}-${index}`} type="button" onClick={() => onOpenFile(file.id)} className="flex w-full items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-3 text-left text-xs ring-1 ring-slate-200 hover:bg-emerald-50 hover:ring-emerald-100">
                    <span className="min-w-0 truncate font-black text-slate-800">{file.originalName || file.fileName || 'Tệp kết quả'}</span>
                    <span className="shrink-0 font-bold text-slate-500">{formatFileSize(file.size)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">Chưa có tệp kết quả.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const st = getMedicalOrderStatus(status);
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-black ${st.color}`}><span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${st.dot}`} />{st.shortLabel}</span>;
}

function InfoCard({ label, value }) {
  return <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p><p className="mt-1 whitespace-pre-wrap text-sm font-bold text-slate-900">{value}</p></div>;
}

function Empty({ title }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-12 text-center"><strong className="text-slate-900">{title}</strong><p className="mt-1 text-sm font-semibold text-slate-500">Thử đổi từ khóa tìm kiếm hoặc kiểm tra lại kho kết quả.</p></div>;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : 'Chưa cập nhật';
}

function formatFileSize(bytes = 0) {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

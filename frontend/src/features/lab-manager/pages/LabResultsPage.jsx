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
      if (dl.data?.url) {
        window.open(dl.data.url, '_blank', 'noopener,noreferrer');
      }
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
      } finally { if (mounted) setLoading(false); }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const results = useMemo(() => orders.flatMap((order) => (order.results || []).map((result) => ({ ...result, order }))), [orders]);
  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return results;
    return results.filter((r) => [r.resultCode, r.note, r.order?.orderCode, r.order?.orderType, r.order?.patient?.fullName, r.order?.patient?.patientCode].filter(Boolean).some((v) => String(v).toLowerCase().includes(text)));
  }, [query, results]);

  return (
    <DashboardLayout user={user} navItems={LAB_MANAGER_NAV_ITEMS} activeItem="results" onNavigate={(id) => navigate(labManagerRouteFor(id))} onLogout={logout}>
      <div className="max-w-7xl mx-auto space-y-4 pb-10">
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div><p className="text-[10px] uppercase tracking-[0.18em] font-black text-cyan-600">Kho kết quả</p><h1 className="mt-1 text-2xl font-black text-slate-950">Kết quả CLS</h1></div>
            <button onClick={() => navigate('/lab-manager/orders')} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-50">Phiếu CLS</button>
          </div>
        </section>
        <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm kết quả, bệnh nhân, phiếu..." className="w-full lg:max-w-md rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold outline-none focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-50" />
            <span className="rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-700">{filtered.length} kết quả</span>
          </div>
          {loading ? <div className="py-16"><LoadingIndicator size="lg" label="Đang tải kết quả..." /></div> : filtered.length > 0 ? <ResultList results={filtered} onOpen={setSelectedResult} /> : <Empty title="Không có dữ liệu" />}
        </section>
      </div>
      {selectedResult && <ResultModal result={selectedResult} onOpenFile={openResultFile} onClose={() => setSelectedResult(null)} />}
    </DashboardLayout>
  );
}
function ResultList({ results, onOpen }) { return <div className="overflow-hidden rounded-2xl border border-slate-100"><table className="ui-table min-w-full text-left"><thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Kết quả</th><th className="px-4 py-3">Bệnh nhân</th><th className="px-4 py-3">Chỉ định</th><th className="px-4 py-3">Tệp</th><th className="px-4 py-3 text-right">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">{results.map((result) => <ResultRow key={result.id} result={result} onClick={() => onOpen(result)} />)}</tbody></table></div>; }
function ResultRow({ result, onClick }) { return <tr className="hover:bg-slate-50"><td className="px-4 py-4"><strong className="font-mono text-xs text-slate-900">{result.resultCode}</strong><p className="text-[11px] font-semibold text-slate-500">{result.createdAt ? new Date(result.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : 'N/A'}</p></td><td className="px-4 py-4"><p className="text-sm font-black text-slate-900">{result.order?.patient?.fullName}</p><p className="text-xs font-semibold text-slate-500">{result.order?.patient?.patientCode}</p></td><td className="px-4 py-4"><p className="text-sm font-bold text-slate-800">{result.order?.orderType}</p><StatusBadge status={result.order?.status} /></td><td className="px-4 py-4 text-xs font-black text-cyan-700">{result.files?.length || 0} tệp</td><td className="px-4 py-4 text-right"><button onClick={onClick} className="rounded-xl bg-cyan-600 px-3 py-2 text-xs font-black text-white hover:bg-cyan-700">Xem</button></td></tr>; }
function ResultModal({ result, onOpenFile, onClose }) { useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = 'unset'; }; }, []); return <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"><div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} /><div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"><div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5"><div><div className="mb-2 flex flex-wrap gap-2"><span className="rounded-lg bg-cyan-50 px-2.5 py-1 text-xs font-black text-cyan-700">{result.resultCode}</span><StatusBadge status={result.order?.status} /></div><h2 className="text-xl font-black text-slate-950">{result.order?.orderType}</h2></div><button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">×</button></div><div className="grid flex-1 gap-5 overflow-y-auto p-5 lg:grid-cols-[0.9fr_1.1fr]"><section className="space-y-3"><InfoCard label="Bệnh nhân" value={`${result.order?.patient?.fullName || 'N/A'} · ${result.order?.patient?.patientCode || ''}`} /><InfoCard label="Phiếu" value={result.order?.orderCode || 'N/A'} /><InfoCard label="Ghi chú" value={result.note || 'Không có'} /></section><section className="rounded-2xl border border-slate-100 bg-slate-50 p-5"><h3 className="mb-4 text-lg font-black text-slate-950">Tệp kết quả</h3>{result.files?.length ? <div className="space-y-2">{result.files.map((file, i) => <button key={file.id || i} type="button" onClick={() => onOpenFile(file.id)} className="block w-full text-left rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-100">{file.originalName || 'Xem tệp'}</button>)}</div> : <p className="text-sm font-semibold text-slate-500">Chưa có tệp</p>}</section></div></div></div>; }
function StatusBadge({ status }) { const st = getMedicalOrderStatus(status); return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-black ${st.color}`}><span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${st.dot}`} />{st.shortLabel}</span>; }
function InfoCard({ label, value }) { return <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><p className="text-[11px] uppercase font-bold tracking-wider text-slate-500">{label}</p><p className="mt-1 text-sm font-bold text-slate-900 whitespace-pre-wrap">{value}</p></div>; }
function Alert({ tone, message }) { const cls = tone === 'error' ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-emerald-50 border-emerald-100 text-emerald-800'; return <div className={`rounded-2xl border p-4 text-sm font-bold ${cls}`}>{message}</div>; }
function Empty({ title }) { return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-12 text-center"><strong className="text-slate-900">{title}</strong></div>; }

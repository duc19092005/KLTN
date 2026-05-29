import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { medicalOrderService } from '../../medical-order/apis/medicalOrderService';
import { LAB_MANAGER_NAV_ITEMS, labManagerRouteFor } from '../constants/navigation';

function getItems(data) { return Array.isArray(data) ? data : data?.items || []; }
function fileUrl(file) { return file.url?.startsWith('http') ? file.url : `${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001'}${file.url}`; }

export default function LabResultsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true); setError('');
      try {
        const res = await medicalOrderService.list({ status: 'RESULT_READY' });
        if (mounted) setOrders(getItems(res.data));
      } catch (err) { if (mounted) setError(err.response?.data?.message || 'Không tải được kết quả đã trả'); }
      finally { if (mounted) setLoading(false); }
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

  return <DashboardLayout user={user} navItems={LAB_MANAGER_NAV_ITEMS} activeItem="results" onNavigate={(id) => navigate(labManagerRouteFor(id))} onLogout={logout}>
    <div className="max-w-7xl mx-auto space-y-6">
      <section className="rounded-[32px] border border-emerald-100 bg-gradient-to-br from-white via-emerald-50 to-blue-50 p-8 shadow-sm"><p className="text-[11px] uppercase tracking-[0.28em] font-black text-emerald-600">MedicalResult Archive</p><h1 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight text-slate-950">Kết quả đã trả</h1><p className="mt-3 max-w-3xl text-sm text-slate-600">Page riêng để xem lại các MedicalResult đã upload và file ảnh/PDF đính kèm.</p></section>
      {error && <Alert tone="error" message={error} />}
      <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm mã kết quả, bệnh nhân, chỉ định..." className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" /></section>
      {loading ? <LoadingIndicator size="lg" label="Đang tải kết quả..." /> : (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((result) => <ResultCard key={result.id} result={result} />)}
          {!filtered.length && <div className="lg:col-span-2"><Empty title="Chưa có kết quả" desc="Các MedicalResult đã trả sẽ hiển thị tại đây." /></div>}
        </section>
      )}
    </div>
  </DashboardLayout>;
}

function ResultCard({ result }) { return <article className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] uppercase tracking-wider font-black text-slate-400">{result.resultCode}</p><h3 className="mt-1 text-lg font-black text-slate-950">{result.order?.orderType}</h3><p className="mt-1 text-xs font-semibold text-slate-500">{result.order?.patient?.fullName} · {result.order?.patient?.patientCode}</p></div><span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[10px] font-black text-emerald-700">Đã trả</span></div><div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4"><p className="text-[10px] uppercase tracking-wider font-black text-slate-400">Ghi chú</p><p className="mt-1 text-sm font-semibold text-slate-700">{result.note || 'Không có ghi chú'}</p></div>{result.files?.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{result.files.map((file) => <a key={file.id} href={fileUrl(file)} target="_blank" rel="noreferrer" className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-100">{file.originalName}</a>)}</div>}</article>; }
function Alert({ tone, message }) { const cls = tone === 'error' ? 'bg-red-50 border-red-100 text-red-700' : 'bg-emerald-50 border-emerald-100 text-emerald-800'; return <div className={`rounded-2xl border p-4 text-sm font-bold ${cls}`}>{message}</div>; }
function Empty({ title, desc }) { return <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center"><strong className="text-slate-800">{title}</strong><p className="mt-1 text-sm text-slate-500">{desc}</p></div>; }

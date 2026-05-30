import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { medicalOrderService } from '../../medical-order/apis/medicalOrderService';
import { LAB_MANAGER_NAV_ITEMS, labManagerRouteFor } from '../constants/navigation';
import { getMedicalOrderStatus } from '../constants/medicalOrderStatus';

const STATUS_FILTERS = ['', 'ORDERED', 'IN_PROGRESS', 'RESULT_READY', 'CANCELLED'];
const emptyResult = { files: [], note: '' };
function getItems(data) { return Array.isArray(data) ? data : data?.items || []; }
function getActionLabel(status) { return status === 'ORDERED' ? 'Nhận xử lý' : status === 'IN_PROGRESS' ? 'Trả kết quả' : status === 'RESULT_READY' ? 'Xem kết quả' : 'Xem'; }

export default function LabOrdersPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [filter, setFilter] = useState('ORDERED');
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(emptyResult);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await medicalOrderService.list(filter ? { status: filter } : {});
      const items = getItems(res.data);
      setOrders(items);
      if (activeOrder) setActiveOrder(items.find((o) => o.id === activeOrder.id) || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Không tải được phiếu');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filter]);
  useEffect(() => { setForm(emptyResult); setError(''); setSuccess(''); }, [activeOrder?.id]);

  const filteredOrders = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return orders;
    return orders.filter((o) => [o.orderCode, o.orderType, o.patient?.fullName, o.patient?.patientCode, o.doctor?.staffProfile?.fullName, getMedicalOrderStatus(o.status).label].filter(Boolean).some((v) => String(v).toLowerCase().includes(text)));
  }, [orders, query]);

  const tabCounts = useMemo(() => STATUS_FILTERS.map((status) => ({ status, label: status ? getMedicalOrderStatus(status).shortLabel : 'Tất cả', count: status ? orders.filter((o) => o.status === status).length : orders.length })), [orders]);

  const updateStatus = async (status) => {
    if (!activeOrder) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      await medicalOrderService.updateStatus(activeOrder.id, status);
      setSuccess(`Đã cập nhật: ${getMedicalOrderStatus(status).label}.`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Không cập nhật được trạng thái');
    } finally { setBusy(false); }
  };

  const submitResult = async (event) => {
    event.preventDefault();
    if (!activeOrder) return;
    if (!form.files?.length) return setError('Vui lòng upload ít nhất một file kết quả.');
    setBusy(true); setError(''); setSuccess('');
    try {
      const uploadRes = await medicalOrderService.uploadResultFiles(activeOrder.id, form.files);
      await medicalOrderService.createResult(activeOrder.id, { files: uploadRes.data, note: form.note });
      setSuccess('Đã gửi kết quả.');
      setForm(emptyResult);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Lỗi gửi kết quả');
    } finally { setBusy(false); }
  };

  return (
    <DashboardLayout user={user} navItems={LAB_MANAGER_NAV_ITEMS} activeItem="orders" onNavigate={(id) => navigate(labManagerRouteFor(id))} onLogout={logout}>
      <div className="max-w-7xl mx-auto space-y-4 pb-10">
        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div><p className="text-[10px] uppercase tracking-[0.18em] font-black text-emerald-600">Kỹ thuật viên</p><h1 className="mt-1 text-2xl font-black text-slate-950">Phiếu CLS</h1></div>
            <button onClick={load} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 hover:bg-slate-50">↻ Làm mới</button>
          </div>
        </section>

        {(success || error) && <div className="space-y-2">{success && <Alert tone="success" message={success} />}{error && <Alert tone="error" message={error} />}</div>}

        <section className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(260px,1fr)_auto] lg:items-center">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm phiếu, bệnh nhân, bác sĩ..." className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold outline-none focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50" />
            <div className="flex gap-2 overflow-x-auto">
              {tabCounts.map((tab) => <button key={tab.status || 'ALL'} onClick={() => setFilter(tab.status)} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black whitespace-nowrap ${filter === tab.status ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}><span>{tab.label}</span><span className={`rounded-full px-2 py-0.5 text-[10px] ${filter === tab.status ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{tab.count}</span></button>)}
            </div>
          </div>

          <div className="mt-4">
            {loading ? <div className="py-16"><LoadingIndicator size="lg" label="Đang tải phiếu..." /></div> : filteredOrders.length > 0 ? <OrderList orders={filteredOrders} onOpen={setActiveOrder} /> : <Empty title="Không có dữ liệu" />}
          </div>
        </section>
      </div>

      {activeOrder && <OrderModal order={activeOrder} form={form} setForm={setForm} onStatus={updateStatus} onSubmit={submitResult} busy={busy} onClose={() => setActiveOrder(null)} />}
    </DashboardLayout>
  );
}

function OrderList({ orders, onOpen }) {
  return <><div className="hidden overflow-hidden rounded-2xl border border-slate-100 lg:block"><table className="min-w-full text-left"><thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Phiếu</th><th className="px-4 py-3">Bệnh nhân</th><th className="px-4 py-3">Chỉ định</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3 text-right">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">{orders.map((order) => <OrderRow key={order.id} order={order} onClick={() => onOpen(order)} />)}</tbody></table></div><div className="space-y-3 lg:hidden">{orders.map((order) => <OrderMobileCard key={order.id} order={order} onClick={() => onOpen(order)} />)}</div></>;
}
function OrderRow({ order, onClick }) {
  return <tr className="hover:bg-slate-50"><td className="px-4 py-4"><strong className="font-mono text-xs text-slate-900">{order.orderCode}</strong><p className="text-[11px] font-semibold text-slate-500">{order.orderedAt ? new Date(order.orderedAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : 'N/A'}</p></td><td className="px-4 py-4"><p className="text-sm font-black text-slate-900">{order.patient?.fullName}</p><p className="text-xs font-semibold text-slate-500">{order.patient?.patientCode}</p></td><td className="px-4 py-4"><p className="text-sm font-bold text-slate-800">{order.orderType}</p><p className="text-xs font-semibold text-slate-500">BS. {order.doctor?.staffProfile?.fullName || 'N/A'}</p></td><td className="px-4 py-4"><StatusBadge status={order.status} /></td><td className="px-4 py-4 text-right"><ActionButton status={order.status} onClick={onClick} /></td></tr>;
}
function OrderMobileCard({ order, onClick }) { return <div className="rounded-2xl border border-slate-100 bg-white p-4"><div className="flex items-start justify-between gap-3"><div><strong className="font-mono text-xs text-slate-900">{order.orderCode}</strong><p className="mt-1 text-sm font-black text-slate-900">{order.patient?.fullName}</p><p className="text-xs font-semibold text-slate-500">{order.orderType}</p></div><StatusBadge status={order.status} /></div><ActionButton status={order.status} onClick={onClick} className="mt-3 w-full" /></div>; }
function ActionButton({ status, onClick, className = '' }) { const tone = status === 'ORDERED' ? 'bg-blue-600 hover:bg-blue-700' : status === 'IN_PROGRESS' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-900 hover:bg-slate-700'; return <button onClick={onClick} className={`rounded-xl px-3 py-2 text-xs font-black text-white ${tone} ${className}`}>{getActionLabel(status)}</button>; }
function OrderModal({ order, form, setForm, onStatus, onSubmit, busy, onClose }) {
  const isOrdered = order.status === 'ORDERED';
  const isInProgress = order.status === 'IN_PROGRESS';
  useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = 'unset'; }; }, []);
  return <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"><div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} /><div className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"><div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between"><div><div className="mb-2 flex flex-wrap items-center gap-2"><span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">{order.orderCode}</span><StatusBadge status={order.status} /></div><h2 className="text-xl font-black text-slate-950">{order.orderType}</h2></div><div className="flex items-center gap-2">{isOrdered && <button disabled={busy} onClick={() => onStatus('IN_PROGRESS')} className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black text-white hover:bg-blue-700 disabled:opacity-50">Nhận xử lý</button>}<button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">×</button></div></div><div className="grid flex-1 overflow-y-auto p-5 gap-5 lg:grid-cols-[0.95fr_1.05fr]"><section className="space-y-3"><InfoCard label="Bệnh nhân" value={`${order.patient?.fullName || 'N/A'} · ${order.patient?.patientCode || ''}`} /><InfoCard label="Bác sĩ" value={`BS. ${order.doctor?.staffProfile?.fullName || 'N/A'}`} /><InfoCard label="Khoa" value={order.targetDepartment?.name || 'N/A'} /><InfoCard label="Ghi chú" value={order.clinicalNote || 'Không có'} /></section><section>{isOrdered && <StateHint title="Chờ nhận" desc="Bấm Nhận xử lý để bắt đầu." />}{isInProgress && <ResultForm form={form} setForm={setForm} onSubmit={onSubmit} busy={busy} />}{!isOrdered && !isInProgress && <ResultArchive order={order} />}</section></div></div></div>;
}
function StateHint({ title, desc }) { return <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5"><h3 className="font-black text-slate-950">{title}</h3><p className="mt-1 text-sm font-semibold text-slate-500">{desc}</p></div>; }
function ResultForm({ form, setForm, onSubmit, busy }) { return <form onSubmit={onSubmit} className="rounded-3xl border border-emerald-100 bg-emerald-50/50 p-5 space-y-4"><h3 className="text-lg font-black text-slate-950">Trả kết quả</h3><textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={3} placeholder="Ghi chú..." className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm font-medium outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50" /><label className="flex h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-emerald-300 bg-white hover:bg-emerald-50"><span className="text-sm font-black text-emerald-700">Upload kết quả</span><span className="mt-1 text-xs font-semibold text-slate-500">PDF/JPG/PNG</span><input type="file" multiple accept=".pdf,image/*" className="hidden" onChange={(e) => { const picked = Array.from(e.target.files || []); setForm({ ...form, files: [...(form.files || []), ...picked].slice(0, 10) }); e.target.value = ''; }} /></label>{Boolean(form.files?.length) && <div className="grid grid-cols-1 gap-2">{form.files.map((file, idx) => <div key={idx} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3"><span className="truncate text-xs font-bold text-slate-700">{file.name}</span><button type="button" onClick={() => setForm({ ...form, files: form.files.filter((_, i) => i !== idx) })} className="rounded-lg px-2 py-1 text-xs font-black text-red-600 hover:bg-red-50">Xóa</button></div>)}</div>}<button type="submit" disabled={busy || !form.files?.length} className="w-full rounded-2xl bg-emerald-600 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50">{busy ? 'Đang gửi...' : 'Gửi kết quả'}</button></form>; }
function ResultArchive({ order }) { return <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5"><h3 className="mb-4 text-lg font-black text-slate-950">Kết quả</h3>{order.results?.length ? <div className="space-y-3">{order.results.map((r, i) => <div key={r.id || i} className="rounded-2xl border border-slate-100 bg-white p-4">{r.note && <p className="mb-3 text-sm font-semibold text-slate-700">{r.note}</p>}<div className="flex flex-wrap gap-2">{r.files?.map((f, j) => <a key={j} href={f.url} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-100">{f.originalName || 'Xem tệp'}</a>)}</div></div>)}</div> : <p className="text-sm font-semibold text-slate-500">Chưa có file</p>}</div>; }
function StatusBadge({ status }) { const st = getMedicalOrderStatus(status); return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-black ${st.color}`}><span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${st.dot}`} />{st.label}</span>; }
function InfoCard({ label, value }) { return <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><p className="text-[11px] uppercase font-bold tracking-wider text-slate-500">{label}</p><p className="mt-1 text-sm font-bold text-slate-900 whitespace-pre-wrap">{value}</p></div>; }
function Alert({ tone, message }) { const isError = tone === 'error'; return <div className={`rounded-2xl border p-4 text-sm font-bold ${isError ? 'bg-red-50 border-red-100 text-red-700' : 'bg-emerald-50 border-emerald-100 text-emerald-800'}`}>{message}</div>; }
function Empty({ title }) { return <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-12 text-center"><strong className="text-slate-900">{title}</strong></div>; }
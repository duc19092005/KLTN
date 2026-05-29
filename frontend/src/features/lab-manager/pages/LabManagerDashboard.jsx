import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { medicalOrderService } from '../../medical-order/apis/medicalOrderService';

const NAV_ITEMS = [{ id: 'orders', label: 'Chỉ định xét nghiệm', icon: 'activity' }];
const STATUS_FILTERS = ['', 'ORDERED', 'IN_PROGRESS', 'RESULT_READY', 'COMPLETED'];
const emptyResult = { resultSummary: '', conclusion: '', attachmentUrl: '', resultDataText: '' };

function getItems(data) { return Array.isArray(data) ? data : data?.items || []; }
function statusCls(status) { const map = { ORDERED: 'bg-amber-50 text-amber-700 border-amber-100', IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-100', RESULT_READY: 'bg-emerald-50 text-emerald-700 border-emerald-100', COMPLETED: 'bg-slate-100 text-slate-700 border-slate-200', CANCELLED: 'bg-red-50 text-red-700 border-red-100' }; return map[status] || map.ORDERED; }

export default function LabManagerDashboardPage() {
  const { user, logout } = useAuth();
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
      setActiveOrder((current) => current ? (items.find((o) => o.id === current.id) || items[0] || null) : (items[0] || null));
    } catch (err) { setError(err.response?.data?.message || 'Không tải được chỉ định xét nghiệm'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filter]);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return orders;
    return orders.filter((o) => [o.orderCode, o.orderType, o.patient?.fullName, o.patient?.patientCode, o.doctor?.staffProfile?.fullName].filter(Boolean).some((v) => v.toLowerCase().includes(text)));
  }, [orders, query]);

  const updateStatus = async (status) => {
    if (!activeOrder) return;
    setBusy(true); setError(''); setSuccess('');
    try { await medicalOrderService.updateStatus(activeOrder.id, status); setSuccess(`Đã chuyển trạng thái sang ${status}.`); await load(); }
    catch (err) { setError(err.response?.data?.message || 'Không cập nhật được trạng thái'); }
    finally { setBusy(false); }
  };

  const submitResult = async (event) => {
    event.preventDefault();
    if (!activeOrder) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      let resultData;
      if (form.resultDataText.trim()) resultData = JSON.parse(form.resultDataText);
      await medicalOrderService.createResult(activeOrder.id, { resultSummary: form.resultSummary, conclusion: form.conclusion, attachmentUrl: form.attachmentUrl, resultData });
      setSuccess('Đã trả MedicalResult cho bác sĩ.');
      setForm(emptyResult);
      await load();
    } catch (err) { setError(err.response?.data?.message || err.message || 'Không trả được kết quả'); }
    finally { setBusy(false); }
  };

  const stats = [
    { label: 'Tổng chỉ định', value: orders.length, icon: '🧾' },
    { label: 'Chờ xử lý', value: orders.filter((o) => o.status === 'ORDERED').length, icon: '⏳' },
    { label: 'Đang làm', value: orders.filter((o) => o.status === 'IN_PROGRESS').length, icon: '🔬' },
    { label: 'Có kết quả', value: orders.filter((o) => o.status === 'RESULT_READY').length, icon: '✅' },
  ];

  return <DashboardLayout user={user} navItems={NAV_ITEMS} activeItem="orders" onNavigate={() => {}} onLogout={logout}>
    <div className="max-w-7xl mx-auto space-y-6">
      <section className="relative overflow-hidden rounded-[32px] bg-slate-950 p-8 text-white shadow-2xl shadow-emerald-100"><div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.5),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.28),transparent_36%)]" /><div className="relative flex flex-col xl:flex-row xl:items-end justify-between gap-6"><div><p className="text-[11px] uppercase tracking-[0.28em] font-black text-emerald-200">Lab Manager Workspace</p><h1 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight">Xử lý MedicalOrder & trả MedicalResult</h1><p className="mt-3 max-w-3xl text-sm text-slate-300">Khoa xét nghiệm nhận chỉ định từ bác sĩ, cập nhật tiến độ và trả kết quả về để bác sĩ kết luận cuối.</p></div><div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{stats.map((s) => <div key={s.label} className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur"><p className="text-[10px] uppercase tracking-wider text-slate-300 font-black">{s.label}</p><strong className="mt-2 block text-2xl font-black">{String(s.value).padStart(2, '0')} {s.icon}</strong></div>)}</div></div></section>
      {success && <Alert tone="success" message={success} />}{error && <Alert tone="error" message={error} />}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <aside className="xl:col-span-5 rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden"><div className="p-5 border-b border-slate-100"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm mã chỉ định, bệnh nhân, bác sĩ..." className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" /><div className="mt-4 flex gap-2 overflow-x-auto pb-1">{STATUS_FILTERS.map((s) => <button key={s || 'ALL'} onClick={() => setFilter(s)} className={`px-3 py-2 rounded-xl text-xs font-black border whitespace-nowrap ${filter === s ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-500 border-slate-200'}`}>{s || 'TẤT CẢ'}</button>)}</div></div><div className="p-4 space-y-3 max-h-[760px] overflow-y-auto">{loading && <LoadingIndicator size="lg" label="Đang tải order..." />}{!loading && filtered.map((o) => <OrderCard key={o.id} order={o} active={activeOrder?.id === o.id} onClick={() => setActiveOrder(o)} />)}{!loading && !filtered.length && <Empty title="Không có chỉ định" desc="Các MedicalOrder phù hợp sẽ hiển thị ở đây." />}</div></aside>
        <main className="xl:col-span-7">{!activeOrder ? <Empty title="Chọn một chỉ định" desc="Thông tin và form trả kết quả sẽ hiển thị tại đây." /> : <OrderDetail order={activeOrder} form={form} setForm={setForm} onStatus={updateStatus} onSubmit={submitResult} busy={busy} />}</main>
      </section>
    </div>
  </DashboardLayout>;
}

function OrderCard({ order, active, onClick }) { return <button onClick={onClick} className={`w-full text-left rounded-2xl border p-4 transition-all ${active ? 'border-emerald-300 bg-emerald-50 shadow-lg shadow-emerald-100' : 'border-slate-100 bg-white hover:border-emerald-200 hover:shadow-md'}`}><div className="flex justify-between gap-3"><div><p className="text-[10px] uppercase tracking-wider font-black text-slate-400">{order.orderCode} · {order.priority}</p><h3 className="mt-1 font-black text-slate-950">{order.orderType}</h3><p className="mt-1 text-xs font-semibold text-slate-500">{order.patient?.fullName} · BS. {order.doctor?.staffProfile?.fullName || 'N/A'}</p></div><span className={`h-fit rounded-full border px-2.5 py-1 text-[10px] font-black ${statusCls(order.status)}`}>{order.status}</span></div></button>; }
function OrderDetail({ order, form, setForm, onStatus, onSubmit, busy }) { return <section className="rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden"><div className="bg-gradient-to-br from-emerald-50 via-white to-blue-50 p-6"><div className="flex flex-col sm:flex-row justify-between gap-4"><div><p className="text-[11px] uppercase tracking-[0.22em] text-emerald-600 font-black">{order.orderCode}</p><h2 className="mt-2 text-2xl sm:text-3xl font-black text-slate-950">{order.orderType}</h2><p className="mt-1 text-sm font-semibold text-slate-500">{order.patient?.fullName} · {order.patient?.patientCode}</p></div><span className={`h-fit rounded-full border px-3 py-1.5 text-xs font-black ${statusCls(order.status)}`}>{order.status}</span></div></div><div className="p-6 space-y-5"><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Info label="Bác sĩ chỉ định" value={`BS. ${order.doctor?.staffProfile?.fullName || 'N/A'}`} /><Info label="Khoa nhận" value={order.targetDepartment?.name || 'Chưa gán'} /><div className="md:col-span-2"><Info label="Ghi chú lâm sàng" value={order.clinicalNote || 'Không có'} large /></div></div><div className="flex flex-wrap gap-3"><button disabled={busy || order.status !== 'ORDERED'} onClick={() => onStatus('IN_PROGRESS')} className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50">Nhận xử lý</button><span className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-500">Hoàn tất sẽ được xử lý sau khi có kết quả</span></div><form onSubmit={onSubmit} className="rounded-3xl border border-slate-100 bg-slate-50 p-5 space-y-4"><h3 className="text-xl font-black text-slate-950">Trả MedicalResult</h3><Field required label="Tóm tắt kết quả" value={form.resultSummary} onChange={(v) => setForm({ ...form, resultSummary: v })} /><Field label="Kết luận lab" value={form.conclusion} onChange={(v) => setForm({ ...form, conclusion: v })} /><Field label="Link file/ảnh đính kèm" value={form.attachmentUrl} onChange={(v) => setForm({ ...form, attachmentUrl: v })} /><label className="block"><span className="text-xs font-black text-slate-600">Dữ liệu JSON chỉ số</span><textarea rows={4} value={form.resultDataText} onChange={(e) => setForm({ ...form, resultDataText: e.target.value })} placeholder='{"WBC":"12.5", "CRP":"28"}' className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-mono outline-none" /></label><button disabled={busy || order.status === 'COMPLETED' || order.status === 'CANCELLED'} className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-100 disabled:opacity-60">Trả kết quả về bác sĩ</button></form><div className="space-y-2">{order.results?.map((r) => <div key={r.id} className="rounded-2xl border border-slate-100 bg-white p-4"><strong>{r.resultCode}</strong><p className="text-sm text-slate-700 mt-1">{r.resultSummary}</p>{r.conclusion && <p className="text-xs font-bold text-emerald-700 mt-1">{r.conclusion}</p>}</div>)}</div></div></section>; }
function Field({ label, value, onChange, required = false }) { return <label className="block"><span className="text-xs font-black text-slate-600">{label}</span><input required={required} value={value} onChange={(e) => onChange(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none" /></label>; }
function Info({ label, value, large = false }) { return <div className={`rounded-2xl border border-slate-100 bg-slate-50 p-4 ${large ? 'min-h-[92px]' : ''}`}><p className="mb-1 text-[10px] uppercase tracking-wider text-slate-400 font-black">{label}</p><p className="text-sm font-bold leading-relaxed text-slate-800">{value}</p></div>; }
function Alert({ tone, message }) { const cls = tone === 'error' ? 'bg-red-50 border-red-100 text-red-700' : 'bg-emerald-50 border-emerald-100 text-emerald-800'; return <div className={`rounded-2xl border p-4 text-sm font-bold ${cls}`}>{message}</div>; }
function Empty({ title, desc }) { return <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center"><strong className="text-slate-800">{title}</strong><p className="mt-1 text-sm text-slate-500">{desc}</p></div>; }

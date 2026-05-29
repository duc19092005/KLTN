import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { doctorVisitService } from '../apis/doctorVisitService';
import { DOCTOR_NAV_ITEMS, navigateDoctor } from '../constants/navigation';
import { departmentService } from '../../admin/apis/departmentService';
import { medicalOrderService } from '../../medical-order/apis/medicalOrderService';
import { clinicalDecisionService } from '../../medical-order/apis/clinicalDecisionService';

const STATUS = {
  WAITING: { label: 'Chờ khám', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-400' },
  IN_PROGRESS: { label: 'Đang khám', color: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  WAITING_TEST_RESULT: { label: 'Chờ kết quả XN', color: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500' },
  WAITING_CONCLUSION: { label: 'Chờ kết luận', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' },
  COMPLETED: { label: 'Hoàn tất', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  CANCELLED: { label: 'Đã hủy', color: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
};

const FILTERS = [
  { id: '', label: 'Tất cả' },
  { id: 'WAITING', label: 'Chờ khám' },
  { id: 'IN_PROGRESS', label: 'Đang khám' },
  { id: 'WAITING_TEST_RESULT', label: 'Chờ XN' },
  { id: 'WAITING_CONCLUSION', label: 'Chờ kết luận' },
  { id: 'COMPLETED', label: 'Hoàn tất' },
];

const emptyOrder = { targetDepartmentId: '', orderType: '', priority: 'NORMAL', clinicalNote: '' };
const emptyConclusion = { finalDiagnosis: '', treatmentPlan: '', prescription: '', followUpNote: '', doctorNote: '' };
const QUICK_ORDER_TEMPLATES = [
  { key: 'xray', label: 'X-Ray phổi', orderType: 'X-Ray phổi', departmentHints: ['x-ray', 'xray', 'x quang', 'chẩn đoán hình ảnh', 'chan doan hinh anh'] },
  { key: 'blood', label: 'Xét nghiệm máu', orderType: 'Xét nghiệm máu', departmentHints: ['blood', 'máu', 'mau', 'lab', 'xét nghiệm', 'xet nghiem'] },
];

function getItems(data) { return Array.isArray(data) ? data : data?.items || []; }
function formatDate(value) { return value ? new Date(value).toLocaleDateString('vi-VN') : 'N/A'; }
function formatTime(value) { return value ? new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--'; }
function parseAiResult(value) { try { return JSON.parse(value || '{}'); } catch { return { summary: value }; } }
function normalizeText(value = '') { return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function guessDepartmentId(departments, hints = []) {
  const normalizedHints = hints.map(normalizeText);
  const department = departments.find((item) => {
    const text = normalizeText(`${item.name || ''} ${item.code || ''} ${item.departmentCode || ''}`);
    return normalizedHints.some((hint) => text.includes(hint));
  });
  return department?.id || '';
}

export default function DoctorQueuePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [visits, setVisits] = useState([]);
  const [activeVisit, setActiveVisit] = useState(null);
  const [decision, setDecision] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('WAITING');
  const [query, setQuery] = useState('');
  const [orderForm, setOrderForm] = useState(emptyOrder);
  const [quickOrders, setQuickOrders] = useState(() => QUICK_ORDER_TEMPLATES.map((template) => ({ ...template, targetDepartmentId: '', priority: 'NORMAL', clinicalNote: '' })));
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [conclusionForm, setConclusionForm] = useState(emptyConclusion);
  const [selectedAiId, setSelectedAiId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadVisits = async () => {
    setLoading(true); setError('');
    try {
      const res = await doctorVisitService.list(filter ? { status: filter, limit: 50 } : { limit: 50 });
      const items = getItems(res.data);
      setVisits(items);
      setActiveVisit((current) => current ? (items.find((v) => v.id === current.id) || items[0] || null) : (items[0] || null));
    } catch (err) {
      setError(err.response?.data?.message || 'Không tải được hàng đợi khám');
    } finally { setLoading(false); }
  };

  const loadDecision = async (visitId) => {
    if (!visitId) return;
    setDetailLoading(true);
    try {
      const res = await clinicalDecisionService.getVisitResults(visitId);
      setDecision(res.data);
      const latestAi = res.data?.aiDiagnoses?.[0];
      setSelectedAiId(latestAi?.id || '');
      if (res.data?.finalConclusion) {
        setConclusionForm({
          finalDiagnosis: res.data.finalConclusion.finalDiagnosis || '',
          treatmentPlan: res.data.finalConclusion.treatmentPlan || '',
          prescription: res.data.finalConclusion.prescription || '',
          followUpNote: res.data.finalConclusion.followUpNote || '',
          doctorNote: res.data.finalConclusion.doctorNote || '',
        });
      } else setConclusionForm(emptyConclusion);
    } catch (err) {
      setDecision(null);
    } finally { setDetailLoading(false); }
  };

  useEffect(() => { loadVisits(); }, [filter]);
  useEffect(() => { if (activeVisit?.id) { loadDecision(activeVisit.id); setShowOrderForm(false); } }, [activeVisit?.id]);
  useEffect(() => { departmentService.list().then((res) => setDepartments(getItems(res.data))).catch(() => {}); }, []);
  useEffect(() => {
    if (!departments.length) return;
    setQuickOrders((current) => current.map((order) => ({ ...order, targetDepartmentId: order.targetDepartmentId || guessDepartmentId(departments, order.departmentHints) })));
  }, [departments]);

  const filteredVisits = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return visits;
    return visits.filter((visit) => [visit.visitCode, visit.patient?.patientCode, visit.patient?.fullName, visit.patient?.phone, visit.patient?.citizenId, visit.clinicalRoom?.roomName].filter(Boolean).some((field) => field.toLowerCase().includes(text)));
  }, [query, visits]);

  const submitOrder = async (event) => {
    event.preventDefault();
    if (!activeVisit) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      await medicalOrderService.create({ ...orderForm, visitId: activeVisit.id, targetDepartmentId: orderForm.targetDepartmentId || undefined });
      setSuccess('Đã tạo chỉ định xét nghiệm/cận lâm sàng.');
      setOrderForm(emptyOrder);
      setShowOrderForm(false);
      await Promise.all([loadVisits(), loadDecision(activeVisit.id)]);
    } catch (err) { setError(err.response?.data?.message || 'Không tạo được chỉ định'); }
    finally { setBusy(false); }
  };

  const submitQuickOrders = async (event) => {
    event.preventDefault();
    if (!activeVisit) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      for (const order of quickOrders) {
        await medicalOrderService.create({
          visitId: activeVisit.id,
          targetDepartmentId: order.targetDepartmentId || undefined,
          orderType: order.orderType,
          priority: order.priority,
          clinicalNote: order.clinicalNote || `${order.label} theo chỉ định bác sĩ`,
        });
      }
      setSuccess('Đã tạo 2 chỉ định: X-Ray phổi và Xét nghiệm máu.');
      setShowOrderForm(false);
      await Promise.all([loadVisits(), loadDecision(activeVisit.id)]);
    } catch (err) { setError(err.response?.data?.message || 'Không tạo được bộ chỉ định cận lâm sàng'); }
    finally { setBusy(false); }
  };

  const generateAi = async () => {
    if (!activeVisit) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      const res = await clinicalDecisionService.generateAiAnalysis({ visitId: activeVisit.id });
      setSelectedAiId(res.data.id);
      setSuccess('AI đã phân tích hỗ trợ dựa trên kết quả hiện có.');
      await loadDecision(activeVisit.id);
    } catch (err) { setError(err.response?.data?.message || 'Không tạo được phân tích AI'); }
    finally { setBusy(false); }
  };

  const submitConclusion = async (event) => {
    event.preventDefault();
    if (!activeVisit) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      await clinicalDecisionService.createConclusion({ ...conclusionForm, visitId: activeVisit.id, aiDiagnosisId: selectedAiId || undefined });
      setSuccess('Đã lưu kết luận cuối và hoàn tất lượt khám.');
      await Promise.all([loadVisits(), loadDecision(activeVisit.id)]);
    } catch (err) { setError(err.response?.data?.message || 'Không lưu được kết luận cuối'); }
    finally { setBusy(false); }
  };

  return (
    <DashboardLayout user={user} navItems={DOCTOR_NAV_ITEMS} activeItem="queue" onNavigate={(id) => navigateDoctor(navigate, id)} onLogout={logout}>
      <div className="max-w-7xl mx-auto space-y-6">
        <section className="relative overflow-hidden rounded-[28px] border border-blue-100 bg-gradient-to-br from-white via-blue-50 to-emerald-50 p-7 shadow-sm">
          <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-5"><div><p className="text-[11px] uppercase tracking-[0.24em] font-black text-blue-600">Doctor Clinical Workspace</p><h1 className="mt-2 text-3xl font-black text-slate-950 tracking-tight">Hàng đợi khám & Kết luận</h1><p className="mt-2 max-w-3xl text-sm text-slate-600">Bác sĩ tạo chỉ định, xem kết quả từ khoa xét nghiệm, gọi AI hỗ trợ và nhập kết luận cuối.</p></div><button onClick={loadVisits} className="h-11 px-4 rounded-2xl border border-blue-100 bg-white text-sm font-black text-blue-700 hover:bg-blue-50 transition-all">{loading ? <LoadingIndicator size="sm" /> : 'Làm mới'}</button></div>
        </section>
        {success && <Alert tone="success" message={success} />}{error && <Alert tone="error" message={error} />}
        <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <aside className="xl:col-span-4 rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden"><div className="p-5 border-b border-slate-100"><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm theo tên, mã BN, SĐT..." className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-semibold outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-100" /></div><div className="mt-4 flex gap-2 overflow-x-auto pb-1">{FILTERS.map((item) => <button key={item.id || 'ALL'} onClick={() => setFilter(item.id)} className={`px-3 py-2 rounded-xl text-xs font-black border whitespace-nowrap ${filter === item.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>{item.label}</button>)}</div></div><div className="p-4 space-y-3 max-h-[760px] overflow-y-auto">{loading && <LoadingIndicator size="lg" label="Đang tải..." />}{!loading && filteredVisits.map((visit) => <VisitCard key={visit.id} visit={visit} active={activeVisit?.id === visit.id} onClick={() => setActiveVisit(visit)} />)}{!loading && !filteredVisits.length && <Empty title="Không có lượt khám" desc="Thử đổi bộ lọc hoặc làm mới." />}</div></aside>
          <main className="xl:col-span-8 space-y-6">{!activeVisit ? <Empty title="Chọn lượt khám" desc="Chọn bệnh nhân để mở workflow lâm sàng." /> : <><VisitHeader visit={decision || activeVisit} detailLoading={detailLoading} /><OrderPanel visit={decision || activeVisit} form={orderForm} setForm={setOrderForm} quickOrders={quickOrders} setQuickOrders={setQuickOrders} departments={departments} onSubmit={submitOrder} onSubmitQuick={submitQuickOrders} busy={busy} open={showOrderForm} setOpen={setShowOrderForm} /><ResultsPanel orders={decision?.medicalOrders || []} /><AiPanel diagnoses={decision?.aiDiagnoses || []} selectedAiId={selectedAiId} setSelectedAiId={setSelectedAiId} onGenerate={generateAi} busy={busy} /><ConclusionPanel form={conclusionForm} setForm={setConclusionForm} onSubmit={submitConclusion} busy={busy} completed={Boolean(decision?.finalConclusion)} /></>}</main>
        </section>
      </div>
    </DashboardLayout>
  );
}

function VisitCard({ visit, active, onClick }) { const st = STATUS[visit.status] || STATUS.WAITING; return <button onClick={onClick} className={`w-full text-left rounded-2xl border p-4 transition-all ${active ? 'border-blue-300 bg-blue-50 shadow-lg shadow-blue-100' : 'border-slate-100 bg-white hover:border-blue-200 hover:shadow-md'}`}><div className="flex justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{visit.visitCode} · {formatTime(visit.checkInAt)}</p><h3 className="mt-1 truncate font-black text-slate-950">{visit.patient?.fullName || 'Không rõ bệnh nhân'}</h3><p className="mt-1 text-xs font-semibold text-slate-500">{visit.patient?.patientCode} · {visit.patient?.phone || 'Chưa có SĐT'}</p></div><span className={`h-fit rounded-full border px-2.5 py-1 text-[10px] font-black whitespace-nowrap ${st.color}`}>{st.label}</span></div></button>; }
function VisitHeader({ visit, detailLoading }) { const st = STATUS[visit.status] || STATUS.WAITING; return <section className="rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden"><div className="bg-gradient-to-br from-blue-50 via-white to-emerald-50 p-6"><div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4"><div><p className="text-[11px] uppercase tracking-[0.22em] text-blue-500 font-black">Phiếu khám · {visit.visitCode}</p><h2 className="mt-2 text-2xl sm:text-3xl font-black text-slate-950">{visit.patient?.fullName}</h2><p className="mt-1 text-sm font-semibold text-slate-500">{visit.patient?.patientCode} · CCCD: {visit.patient?.citizenId || 'N/A'} · {detailLoading ? 'Đang đồng bộ...' : 'Đã đồng bộ'}</p></div><span className={`h-fit rounded-full border px-3 py-1.5 text-xs font-black ${st.color}`}><span className={`mr-2 inline-block h-2 w-2 rounded-full ${st.dot}`} />{st.label}</span></div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6"><Info label="Ngày sinh" value={formatDate(visit.patient?.birthDate)} /><Info label="Phòng khám" value={visit.clinicalRoom?.roomName || 'N/A'} /><div className="md:col-span-2"><Info label="Triệu chứng ban đầu" value={visit.symptoms || 'Chưa ghi nhận'} large /></div></div></section>; }
function OrderPanel({ visit, form, setForm, quickOrders, setQuickOrders, departments, onSubmit, onSubmitQuick, busy, open, setOpen }) {
  const canOrder = visit?.status === 'IN_PROGRESS';
  return <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm space-y-4"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.2em] font-black text-purple-500">Medical Order</p><h3 className="text-xl font-black text-slate-950">Chỉ định xét nghiệm/cận lâm sàng</h3><p className="mt-1 text-sm text-slate-500">Tạo order thật cho khoa X-Ray, Blood Test/Lab hoặc khoa cận lâm sàng khác.</p></div><button type="button" disabled={!canOrder} onClick={() => setOpen(!open)} className="rounded-2xl bg-purple-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-purple-100 disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none">{open ? 'Đóng form' : 'Chỉ định xét nghiệm/cận lâm sàng'}</button></div>{!canOrder && <p className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-bold text-amber-700">Chỉ mở form chỉ định khi lượt khám đang ở trạng thái Đang khám.</p>}{open && canOrder && <div className="space-y-5"><form onSubmit={onSubmitQuick} className="rounded-3xl border border-purple-100 bg-purple-50/50 p-5 space-y-4"><div><h4 className="font-black text-slate-950">Tạo nhanh 2 chỉ định thường dùng</h4><p className="text-sm text-slate-500">Bao gồm X-Ray phổi và Xét nghiệm máu. Hãy chọn đúng khoa nhận trước khi tạo.</p></div><div className="grid grid-cols-1 md:grid-cols-2 gap-3">{quickOrders.map((order, index) => <div key={order.key} className="rounded-2xl border border-white bg-white p-4 space-y-3"><strong className="text-slate-950">{order.label}</strong><label className="block"><span className="text-xs font-black text-slate-600">Khoa nhận</span><select required value={order.targetDepartmentId} onChange={(e) => setQuickOrders(quickOrders.map((item, i) => i === index ? { ...item, targetDepartmentId: e.target.value } : item))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none"><option value="">Chọn khoa</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label className="block"><span className="text-xs font-black text-slate-600">Ưu tiên</span><select value={order.priority} onChange={(e) => setQuickOrders(quickOrders.map((item, i) => i === index ? { ...item, priority: e.target.value } : item))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none"><option>NORMAL</option><option>URGENT</option><option>STAT</option></select></label><TextArea label="Ghi chú" value={order.clinicalNote} onChange={(value) => setQuickOrders(quickOrders.map((item, i) => i === index ? { ...item, clinicalNote: value } : item))} /></div>)}</div><button disabled={busy} className="rounded-2xl bg-purple-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-purple-100 disabled:opacity-60">Tạo 2 order X-Ray + Máu</button></form><form onSubmit={onSubmit} className="rounded-3xl border border-slate-100 bg-slate-50 p-5 space-y-4"><h4 className="font-black text-slate-950">Tạo chỉ định tùy chỉnh</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><Field required label="Loại chỉ định" value={form.orderType} onChange={(v) => setForm({ ...form, orderType: v })} placeholder="VD: Siêu âm ổ bụng" /><label><span className="text-xs font-black text-slate-600">Khoa nhận</span><select required value={form.targetDepartmentId} onChange={(e) => setForm({ ...form, targetDepartmentId: e.target.value })} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none"><option value="">Chọn khoa</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label><span className="text-xs font-black text-slate-600">Ưu tiên</span><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none"><option>NORMAL</option><option>URGENT</option><option>STAT</option></select></label><Field label="Ghi chú lâm sàng" value={form.clinicalNote} onChange={(v) => setForm({ ...form, clinicalNote: v })} placeholder="Lý do chỉ định" /></div><button disabled={busy} className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-100 disabled:opacity-60">Tạo chỉ định tùy chỉnh</button></form></div>}</section>;
}
function ResultsPanel({ orders }) { return <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm"><div className="mb-4"><p className="text-[10px] uppercase tracking-[0.2em] font-black text-emerald-500">Medical Results</p><h3 className="text-xl font-black text-slate-950">Kết quả từ khoa xét nghiệm</h3></div><div className="space-y-3">{orders.map((o) => <div key={o.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><div className="flex justify-between gap-3"><div><strong className="text-slate-950">{o.orderType}</strong><p className="text-xs font-semibold text-slate-500">{o.orderCode} · {o.targetDepartment?.name || 'Chưa gán khoa'} · {o.priority}</p></div><span className="h-fit rounded-full bg-white px-2 py-1 text-[10px] font-black text-blue-700">{o.status}</span></div>{o.results?.length ? <div className="mt-3 space-y-2">{o.results.map((r) => <div key={r.id} className="rounded-xl bg-white border border-slate-100 p-3"><p className="text-sm font-bold text-slate-800">{r.resultSummary}</p>{r.conclusion && <p className="mt-1 text-xs font-semibold text-emerald-700">Kết luận lab: {r.conclusion}</p>}</div>)}</div> : <p className="mt-3 text-sm text-slate-400">Chưa có kết quả.</p>}</div>)}{!orders.length && <Empty title="Chưa có chỉ định" desc="Tạo MedicalOrder để khoa xét nghiệm thực hiện." />}</div></section>; }
function AiPanel({ diagnoses, selectedAiId, setSelectedAiId, onGenerate, busy }) { return <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4"><div><p className="text-[10px] uppercase tracking-[0.2em] font-black text-blue-500">AI Clinical Support</p><h3 className="text-xl font-black text-slate-950">AI phân tích hỗ trợ</h3></div><button disabled={busy} onClick={onGenerate} className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-100 disabled:opacity-60">AI phân tích</button></div><div className="space-y-3">{diagnoses.map((d) => <AiDiagnosisCard key={d.id} diagnosis={d} selected={selectedAiId === d.id} onSelect={() => setSelectedAiId(d.id)} />)}{!diagnoses.length && <Empty title="Chưa có phân tích AI" desc="Sau khi có kết quả, bấm AI phân tích để tạo gợi ý hỗ trợ." />}</div></section>; }
function AiDiagnosisCard({ diagnosis, selected, onSelect }) { const parsed = parseAiResult(diagnosis.result); const analysis = parsed.analysis; return <label className={`block rounded-2xl border p-4 cursor-pointer ${selected ? 'border-blue-300 bg-blue-50' : 'border-slate-100 bg-slate-50'}`}><input type="radio" className="mr-2" checked={selected} onChange={onSelect} /><strong className="text-slate-950">{parsed.modelName || diagnosis.aiModel?.modelName || 'AI Model'}</strong><p className="mt-1 text-xs font-bold text-slate-500">{parsed.provider || diagnosis.aiModel?.provider || 'provider'} · {parsed.modelVersion || diagnosis.aiModel?.modelVersion || 'version'} · {parsed.generatedAt ? new Date(parsed.generatedAt).toLocaleString('vi-VN') : 'N/A'}</p><div className="mt-3 space-y-3"><AnalysisBlock analysis={analysis} fallback={diagnosis.result} /><p className="rounded-xl border border-blue-100 bg-white/80 p-3 text-xs font-bold text-blue-700">{parsed.disclaimer || (typeof analysis === 'object' ? analysis?.disclaimer : '') || 'AI chỉ hỗ trợ tham khảo, không thay thế quyết định chuyên môn của bác sĩ.'}</p></div></label>; }
function AnalysisBlock({ analysis, fallback }) { if (analysis && typeof analysis === 'object' && !Array.isArray(analysis)) return <div className="space-y-2"><AiText label="Tóm tắt" value={analysis.summary} /><AiList label="Cân nhắc lâm sàng" value={analysis.clinicalConsiderations} /><AiList label="Cảnh báo rủi ro" value={analysis.riskFlags} /><AiList label="Bước tiếp theo đề xuất" value={analysis.recommendedNextSteps} /><AiList label="Giới hạn" value={analysis.limitations} /></div>; if (typeof analysis === 'string') return <p className="text-sm font-semibold text-slate-700 leading-relaxed">{analysis}</p>; return <p className="text-sm font-semibold text-slate-700 leading-relaxed">{String(fallback || 'Không có nội dung phân tích')}</p>; }
function AiText({ label, value }) { if (!value) return null; return <div><p className="text-[10px] uppercase tracking-wider font-black text-slate-400">{label}</p><p className="text-sm font-semibold text-slate-700 leading-relaxed">{String(value)}</p></div>; }
function AiList({ label, value }) { if (!value) return null; const items = Array.isArray(value) ? value : [value]; return <div><p className="text-[10px] uppercase tracking-wider font-black text-slate-400">{label}</p><ul className="mt-1 list-disc pl-5 text-sm font-semibold text-slate-700 space-y-1">{items.map((item, index) => <li key={`${label}-${index}`}>{typeof item === 'object' ? JSON.stringify(item) : String(item)}</li>)}</ul></div>; }
function ConclusionPanel({ form, setForm, onSubmit, busy, completed }) { return <form onSubmit={onSubmit} className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm space-y-4"><div><p className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-500">Final Decision</p><h3 className="text-xl font-black text-slate-950">Kết luận cuối của bác sĩ</h3>{completed && <p className="mt-1 text-sm font-bold text-emerald-600">Lượt khám đã có kết luận cuối.</p>}</div><Field required label="Chẩn đoán cuối" value={form.finalDiagnosis} onChange={(v) => setForm({ ...form, finalDiagnosis: v })} /><TextArea label="Phác đồ điều trị" value={form.treatmentPlan} onChange={(v) => setForm({ ...form, treatmentPlan: v })} /><TextArea label="Đơn thuốc" value={form.prescription} onChange={(v) => setForm({ ...form, prescription: v })} /><TextArea label="Hẹn tái khám" value={form.followUpNote} onChange={(v) => setForm({ ...form, followUpNote: v })} /><TextArea label="Ghi chú bác sĩ" value={form.doctorNote} onChange={(v) => setForm({ ...form, doctorNote: v })} /><button disabled={busy} className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-100 disabled:opacity-60">Lưu kết luận & hoàn tất</button></form>; }
function Field({ label, value, onChange, required = false, placeholder = '' }) { return <label className="block"><span className="text-xs font-black text-slate-600">{label}</span><input required={required} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" /></label>; }
function TextArea({ label, value, onChange }) { return <label className="block"><span className="text-xs font-black text-slate-600">{label}</span><textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" /></label>; }
function Info({ label, value, large = false }) { return <div className={`rounded-2xl border border-slate-100 bg-slate-50 p-4 ${large ? 'min-h-[92px]' : ''}`}><p className="mb-1 text-[10px] uppercase tracking-wider text-slate-400 font-black">{label}</p><p className="text-sm font-bold leading-relaxed text-slate-800">{value}</p></div>; }
function Alert({ tone, message }) { const cls = tone === 'error' ? 'bg-red-50 border-red-100 text-red-700' : 'bg-emerald-50 border-emerald-100 text-emerald-800'; return <div className={`rounded-2xl border p-4 text-sm font-bold ${cls}`}>{message}</div>; }
function Empty({ title, desc }) { return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center"><strong className="text-slate-800">{title}</strong><p className="mt-1 text-sm text-slate-500">{desc}</p></div>; }

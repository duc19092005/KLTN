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
import { aiModelService } from '../../admin/apis/aiModelService';

const STATUS = {
  WAITING: { label: 'Chờ khám', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-400' },
  IN_PROGRESS: { label: 'Đang khám', color: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  WAITING_TEST_RESULT: { label: 'Chờ kết quả CLS', color: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500' },
  WAITING_CONCLUSION: { label: 'Chờ kết luận', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' },
  COMPLETED: { label: 'Hoàn tất', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  CANCELLED: { label: 'Đã hủy', color: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
};

const FILTERS = [
  { id: '', label: 'Tất cả' },
  { id: 'WAITING', label: 'Chờ khám' },
  { id: 'IN_PROGRESS', label: 'Đang khám' },
  { id: 'WAITING_TEST_RESULT', label: 'Chờ XN/Cận lâm sàng' },
  { id: 'WAITING_CONCLUSION', label: 'Chờ kết luận' },
  { id: 'COMPLETED', label: 'Hoàn tất' },
];

const emptyOrder = { targetDepartmentId: '', orderType: '', priority: 'NORMAL', clinicalNote: '' };
const emptyConclusion = { finalDiagnosis: '', treatmentPlan: '', prescription: '', followUpNote: '', doctorNote: '' };

function getItems(data) { return Array.isArray(data) ? data : data?.items || []; }
function formatDate(value) { return value ? new Date(value).toLocaleDateString('vi-VN') : 'N/A'; }
function formatTime(value) { return value ? new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--'; }
function parseAiResult(value) { try { return JSON.parse(value || '{}'); } catch { return { summary: value }; } }

export default function DoctorQueuePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [visits, setVisits] = useState([]);
  const [activeVisit, setActiveVisit] = useState(null);
  const [decision, setDecision] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [aiModels, setAiModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('WAITING');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [orderForms, setOrderForms] = useState([{ ...emptyOrder }]);
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [conclusionForm, setConclusionForm] = useState(emptyConclusion);
  const [selectedAiId, setSelectedAiId] = useState('');
  const [selectedAiModelId, setSelectedAiModelId] = useState('');
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

      // Tự động định tuyến bước thông minh dựa trên trạng thái bệnh án
      const currentStatus = res.data?.status;
      if (currentStatus === 'IN_PROGRESS') setActiveStep(1);
      else if (currentStatus === 'WAITING_TEST_RESULT' || currentStatus === 'WAITING_CONCLUSION') setActiveStep(2);
      else if (currentStatus === 'COMPLETED') setActiveStep(3);

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
  useEffect(() => { if (activeVisit?.id) { loadDecision(activeVisit.id); setShowWorkflowModal(false); } }, [activeVisit?.id]);
  useEffect(() => { departmentService.list({ canReceiveOrders: true, status: 'ACTIVE', limit: 100 }).then((res) => setDepartments(getItems(res.data))).catch(() => { }); }, []);
  useEffect(() => { aiModelService.list({ type: 'API' }).then((res) => { const items = getItems(res.data); setAiModels(items); setSelectedAiModelId((current) => current || items[0]?.id || ''); }).catch(() => { }); }, []);

  const filteredVisits = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return visits;
    return visits.filter((visit) => [visit.visitCode, visit.patient?.patientCode, visit.patient?.fullName, visit.patient?.phone, visit.patient?.citizenId, visit.clinicalRoom?.roomName].filter(Boolean).some((field) => field.toLowerCase().includes(text)));
  }, [query, visits]);

  const pageSize = 6;
  const totalPages = Math.max(1, Math.ceil(filteredVisits.length / pageSize));
  const pagedVisits = useMemo(() => filteredVisits.slice((page - 1) * pageSize, page * pageSize), [filteredVisits, page]);
  useEffect(() => { setPage(1); }, [filter, query]);

  const submitOrder = async (event) => {
    event.preventDefault();
    if (!activeVisit) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      const validOrders = orderForms.filter((item) => item.orderType.trim() && item.targetDepartmentId);
      if (!validOrders.length) {
        setError('Vui lòng nhập ít nhất 1 phiếu chỉ định hợp lệ.');
        return;
      }
      const duplicateDepartmentId = validOrders.find((item, index) => validOrders.findIndex((other) => other.targetDepartmentId === item.targetDepartmentId) !== index)?.targetDepartmentId;
      if (duplicateDepartmentId) {
        const duplicatedDepartment = departments.find((department) => department.id === duplicateDepartmentId);
        setError(`Bạn đã chọn khoa/phòng "${duplicatedDepartment?.name || duplicateDepartmentId}" rồi. Vui lòng chọn khoa/phòng khác để tránh trùng phiếu chỉ định.`);
        return;
      }
      await Promise.all(validOrders.map((item) => medicalOrderService.create({ ...item, visitId: activeVisit.id, targetDepartmentId: item.targetDepartmentId || undefined })));
      setSuccess('Đã tạo và gửi chỉ định cận lâm sàng thành công.');
      setOrderForms([{ ...emptyOrder }]);
      await Promise.all([loadVisits(), loadDecision(activeVisit.id)]);
    } catch (err) { setError(err.response?.data?.message || 'Không tạo được chỉ định'); }
    finally { setBusy(false); }
  };

  const startVisit = async (targetVisit = activeVisit) => {
    if (!targetVisit) return;
    setActiveVisit(targetVisit);
    setBusy(true); setError(''); setSuccess('');
    try {
      await doctorVisitService.updateStatus(targetVisit.id, 'IN_PROGRESS');
      setSuccess('Đã tiếp nhận bệnh nhân. Hệ thống chuyển sang Bước 1: Chỉ định cận lâm sàng.');
      await Promise.all([loadVisits(), loadDecision(targetVisit.id)]);
      setActiveStep(1);
      setShowWorkflowModal(true);
    } catch (err) { setError(err.response?.data?.message || 'Không thể bắt đầu khám'); }
    finally { setBusy(false); }
  };

  const generateAi = async () => {
    if (!activeVisit) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      const res = await clinicalDecisionService.generateAiAnalysis({ visitId: activeVisit.id, aiModelId: selectedAiModelId || undefined });
      setSelectedAiId(res.data.id);
      setSuccess('AI đã phân tích dữ liệu lâm sàng thành công.');
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
      setSuccess('Đã đóng hồ sơ bệnh án và hoàn tất lượt khám của bệnh nhân.');
      setShowWorkflowModal(false);
      await loadVisits();
    } catch (err) { setError(err.response?.data?.message || 'Không lưu được kết luận cuối'); }
    finally { setBusy(false); }
  };

  return (
    <DashboardLayout user={user} navItems={DOCTOR_NAV_ITEMS} activeItem="queue" onNavigate={(id) => navigateDoctor(navigate, id)} onLogout={logout}>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        {/* Banner tiêu đề */}
        <section className="relative overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-white via-slate-50 to-blue-50/30 p-6 shadow-sm">
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">Doctor Workspace</span>
              <h1 className="mt-2 text-2xl font-black text-slate-900 tracking-tight">Hàng đợi khám & Quản lý điều trị</h1>
              <p className="mt-1 text-xs text-slate-500">Tiếp nhận bệnh nhân, ra chỉ định xét nghiệm, tham vấn AI chuyên khoa và kê đơn hoàn tất quy trình.</p>
            </div>
            <button onClick={loadVisits} className="self-start md:self-auto h-10 px-4 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm flex items-center gap-2 transition-all">
              {loading ? <LoadingIndicator size="sm" /> : <span>Làm mới danh sách</span>}
            </button>
          </div>
        </section>

        {success && <Alert tone="success" message={success} />}
        {error && <Alert tone="error" message={error} />}

        {/* Danh sách hàng đợi */}
        <QueueList query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} loading={loading} visits={pagedVisits} activeVisit={activeVisit} setActiveVisit={setActiveVisit} page={page} setPage={setPage} totalPages={totalPages} totalItems={filteredVisits.length} busy={busy} onStart={startVisit} onOpenWorkflow={(visit) => { setActiveVisit(visit); setShowWorkflowModal(true); }} />

        {/* Modal Quy trình khám Step-by-Step Chuẩn hóa */}
        {showWorkflowModal && activeVisit && (
          <WorkflowModal
            visit={decision || activeVisit}
            activeStep={activeStep}
            setActiveStep={setActiveStep}
            onClose={() => setShowWorkflowModal(false)}
            orderProps={{ forms: orderForms, setForms: setOrderForms, departments, existingOrders: decision?.medicalOrders || [], onSubmit: submitOrder, busy }}
            resultProps={{ orders: decision?.medicalOrders || [] }}
            aiProps={{ diagnoses: decision?.aiDiagnoses || [], aiModels, selectedAiModelId, setSelectedAiModelId, selectedAiId, setSelectedAiId, onGenerate: generateAi, busy }}
            conclusionProps={{ form: conclusionForm, setForm: setConclusionForm, onSubmit: submitConclusion, busy, completed: Boolean(decision?.finalConclusion) }}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

/* ==========================================
   SUB-COMPONENTS CHUẨN HÓA UI/UX
   ========================================== */

function QueueList({ query, setQuery, filter, setFilter, loading, visits, activeVisit, setActiveVisit, page, setPage, totalPages, totalItems, busy, onStart, onOpenWorkflow }) {
  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">Danh sách hàng đợi lâm sàng</h2>
            <p className="text-xs text-slate-400 mt-0.5">Tìm kiếm, lọc trạng thái và thao tác quy trình điều trị ngay trên từng dòng.</p>
          </div>
          <div className="px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-xs font-bold text-blue-700 w-fit">
            Tổng số: {totalItems} ca bệnh
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-base"></span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nhập tên bệnh nhân, mã BN, CCCD hoặc số điện thoại..." className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-3 pl-11 pr-4 text-xs font-medium outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50/50 transition-all" />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin lg:max-w-[620px]">
            {FILTERS.map((item) => (
              <button key={item.id || 'ALL'} onClick={() => setFilter(item.id)} className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all whitespace-nowrap ${filter === item.id ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>{item.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr className="text-[10px] uppercase tracking-wider text-slate-400 font-black">
              <th className="px-5 py-3">Bệnh nhân</th>
              <th className="px-5 py-3">Mã lượt</th>
              <th className="px-5 py-3">Phòng khám</th>
              <th className="px-5 py-3">Tiếp nhận</th>
              <th className="px-5 py-3">Trạng thái</th>
              <th className="px-5 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={6} className="py-10"><LoadingIndicator size="md" label="Đang cập nhật danh sách..." /></td></tr>
            ) : visits.map((visit) => (
              <VisitRow key={visit.id} visit={visit} active={activeVisit?.id === visit.id} busy={busy} onSelect={() => setActiveVisit(visit)} onStart={() => onStart(visit)} onOpenWorkflow={() => onOpenWorkflow(visit)} />
            ))}
            {!loading && !visits.length && (
              <tr><td colSpan={6} className="p-6"><Empty title="Không tìm thấy lượt khám" desc="Không có hồ sơ nào trùng khớp với bộ lọc hoặc từ khóa tìm kiếm hiện tại." /></td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 p-4 text-xs bg-white">
        <span className="font-medium text-slate-500">Trang <strong className="text-slate-800">{page}</strong> / {totalPages}</span>
        <div className="flex gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 font-bold text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-40 transition-all"> Trước</button>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 font-bold text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-40 transition-all">Sau </button>
        </div>
      </div>
    </section>
  );
}

function VisitRow({ visit, active, busy, onSelect, onStart, onOpenWorkflow }) {
  const st = STATUS[visit.status] || STATUS.WAITING;
  const canStart = visit.status === 'WAITING';
  const canOpenWorkflow = !['WAITING', 'COMPLETED', 'CANCELLED'].includes(visit.status);

  return (
    <tr onClick={onSelect} className={`cursor-pointer transition-all ${active ? 'bg-blue-50/70' : 'bg-white hover:bg-slate-50'}`}>
      <td className="px-5 py-4 min-w-[260px]">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-100 to-cyan-100 text-xs font-black text-blue-700">
            {(visit.patient?.fullName || 'BN').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-black text-slate-900">{visit.patient?.fullName || 'Chưa có tên'}</h3>
            <p className="mt-0.5 text-[11px] font-semibold text-slate-400">{visit.patient?.patientCode || 'N/A'} - {visit.patient?.phone || 'Không có SĐT'}</p>
          </div>
        </div>
      </td>
      <td className="px-5 py-4 whitespace-nowrap">
        <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-mono font-bold text-slate-600">{visit.visitCode}</span>
      </td>
      <td className="px-5 py-4 whitespace-nowrap text-xs font-bold text-slate-700">{visit.clinicalRoom?.roomName || 'N/A'}</td>
      <td className="px-5 py-4 whitespace-nowrap text-xs font-semibold text-slate-500">{formatTime(visit.checkInAt)}</td>
      <td className="px-5 py-4 whitespace-nowrap">
        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-black ${st.color}`}>
          <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${st.dot}`} /> {st.label}
        </span>
      </td>
      <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end gap-2">
          {canStart && (
            <button type="button" disabled={busy} onClick={onStart} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white shadow-sm hover:bg-blue-700 disabled:opacity-50">
              Bắt đầu khám
            </button>
          )}
          {canOpenWorkflow && (
            <button type="button" disabled={busy} onClick={onOpenWorkflow} className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-black text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50">
              Quy trình điều trị
            </button>
          )}
          {!canStart && !canOpenWorkflow && (
            <button type="button" disabled className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-400">
              Đã hoàn tất
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function VisitHeader({ visit, detailLoading, onStart, onContinue, busy }) {
  const st = STATUS[visit.status] || STATUS.WAITING;
  const canStart = visit.status === 'WAITING';
  const canContinue = !canStart && visit.status !== 'COMPLETED' && visit.status !== 'CANCELLED';

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="bg-slate-50/80 border-b border-slate-100 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-slate-500">MÃ LƯỢT KHÁM: {visit.visitCode}</span>
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${st.color}`}>
              <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${st.dot}`} /> {st.label}
            </span>
          </div>
          <h2 className="mt-1.5 text-xl font-black text-slate-900">{visit.patient?.fullName}</h2>
          <p className="text-xs text-slate-400 mt-0.5">Mã bệnh nhân: {visit.patient?.patientCode} | CCCD: {visit.patient?.citizenId || 'Chưa cập nhật'}</p>
        </div>

        <div className="flex items-center gap-2">
          {detailLoading && <span className="text-xs text-slate-400 animate-pulse mr-2">Đang đồng bộ dữ liệu...</span>}
          {canStart && (
            <button type="button" disabled={busy} onClick={onStart} className="w-full sm:w-auto rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-all disabled:opacity-50">Tiếp nhận & Khám</button>
          )}
          {canContinue && (
            <button type="button" disabled={busy} onClick={onContinue} className="w-full sm:w-auto rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition-all disabled:opacity-50">Mở Quy trình điều trị</button>
          )}
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 bg-white">
        <Info label="Ngày sinh / Tuổi" value={formatDate(visit.patient?.birthDate)} />
        <Info label="Phòng chức năng" value={visit.clinicalRoom?.roomName || 'N/A'} />
        <Info label="Thời gian tiếp nhận" value={formatTime(visit.checkInAt)} />
        <div className="md:col-span-3">
          <Info label="Lý do đến khám & Triệu chứng ban đầu" value={visit.symptoms || 'Chưa có ghi nhận bệnh lý sơ bộ.'} large />
        </div>
      </div>
    </section>
  );
}

/* ==========================================
   MODAL WIZARD STEP-BY-STEP CHUẨN HÓA KHÁM BỆNH
   ========================================== */
function WorkflowModal({ visit, activeStep, setActiveStep, onClose, orderProps, resultProps, aiProps, conclusionProps }) {
  // Logic kiểm soát điều kiện chuyển bước UX an toàn
  const handleStepClick = (stepIndex) => {
    setActiveStep(stepIndex);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fadeIn">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl flex flex-col">

        {/* Header Modal cố định */}
        <div className="border-b border-slate-200/80 bg-slate-50/50 p-5 shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Hồ sơ bệnh án điện tử</span>
              <h2 className="text-lg font-black text-slate-900">Tiến trình điều trị: {visit.patient?.fullName} ({visit.visitCode})</h2>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 shadow-xs transition-all">Đóng lại</button>
          </div>

          {/* Stepper Navigation: Chuẩn hóa UI thành dạng Tab có thể nhấn được */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2">
            {[
              { step: 1, title: '1. Chỉ định xét nghiệm', desc: 'Tạo phiếu CLS' },
              { step: 2, title: '2. Kết quả & Trợ lý AI', desc: 'Duyệt kết quả phòng Lab' },
              { step: 3, title: '3. Kết luận & Toa thuốc', desc: 'Đóng bệnh án hoàn tất' }
            ].map((s) => {
              const isCurrent = activeStep === s.step;
              const isPast = activeStep > s.step;
              return (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => handleStepClick(s.step)}
                  className={`text-left rounded-xl p-3 border transition-all ${isCurrent
                    ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-400'
                    : isPast
                      ? 'border-emerald-200 bg-emerald-50/60 text-emerald-800'
                      : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50'
                    }`}
                >
                  <p className="text-[11px] font-black tracking-tight">{s.title}</p>
                  <p className={`text-[10px] font-medium mt-0.5 truncate ${isCurrent ? 'text-blue-500' : isPast ? 'text-emerald-600' : 'text-slate-400'}`}>{s.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Nội dung Modal - Cuộn độc lập dựa trên Step đang Active */}
        <div className="overflow-y-auto p-5 bg-slate-50/40 flex-1 space-y-4">

          {activeStep === 1 && (
            <div className="space-y-4 animate-slideUp">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-800 font-medium">
                <strong>Hướng dẫn:</strong> Bác sĩ thực hiện chọn phân khoa và gõ chỉ định cận lâm sàng (Xét nghiệm máu, X-Quang, Siêu âm...). Phiếu sẽ được chuyển trực tiếp đến phòng máy tương ứng.
              </div>
              <OrderPanel visit={visit} {...orderProps} />
              <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                <button type="button" onClick={() => setActiveStep(2)} className="bg-slate-900 text-white font-bold text-xs px-4 py-2 rounded-xl shadow hover:bg-slate-800">Chuyển sang Bước 2 Đọc kết quả CLS </button>
              </div>
            </div>
          )}

          {activeStep === 2 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-slideUp">
              <div className="space-y-4">
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-xs text-purple-800 font-medium">
                  <strong>Kết quả Phòng Lab:</strong> Danh sách kết quả trả về từ các khoa phòng liên quan.
                </div>
                <ResultsPanel {...resultProps} />
              </div>
              <div className="space-y-4">
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-800 font-medium">
                  <strong>AI Copilot:</strong> Chạy mô hình phân tích để nhận báo cáo gợi ý chẩn đoán tự động.
                </div>
                <AiPanel {...aiProps} />
              </div>
              <div className="col-span-full pt-4 border-t border-slate-200/60 flex justify-between">
                <button type="button" onClick={() => setActiveStep(1)} className="border border-slate-200 bg-white text-slate-700 font-bold text-xs px-4 py-2 rounded-xl hover:bg-slate-50"> Quay lại Bước 1</button>
                <button type="button" onClick={() => setActiveStep(3)} className="bg-slate-900 text-white font-bold text-xs px-4 py-2 rounded-xl shadow hover:bg-slate-800">Tiến hành chẩn đoán cuối & kê đơn (Bước 3) </button>
              </div>
            </div>
          )}

          {activeStep === 3 && (
            <div className="space-y-4 animate-slideUp">
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-xs text-emerald-800 font-medium">
                <strong>Kết luận điều trị:</strong> Nhập chẩn đoán cuối ICD, thiết lập phác đồ, kê đơn thuốc và hẹn ngày tái khám để hoàn tất ca bệnh.
              </div>
              <ConclusionPanel {...conclusionProps} />
              <div className="pt-2 flex justify-start">
                <button type="button" onClick={() => setActiveStep(2)} className="border border-slate-200 bg-white text-slate-700 font-bold text-xs px-4 py-2 rounded-xl hover:bg-slate-50"> Xem lại Kết quả & Gợi ý AI (Bước 2)</button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function OrderPanel({ visit, forms, setForms, departments, existingOrders = [], onSubmit, busy }) {
  const canOrder = ['IN_PROGRESS', 'WAITING_TEST_RESULT'].includes(visit?.status);
  const updateForm = (index, patch) => setForms(forms.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const addForm = () => setForms([...forms, { ...emptyOrder }]);
  const removeForm = (index) => setForms(forms.length > 1 ? forms.filter((_, i) => i !== index) : [{ ...emptyOrder }]);
  const hasDuplicateDepartments = forms.some((form, index) => form.targetDepartmentId && forms.some((other, otherIndex) => otherIndex !== index && other.targetDepartmentId === form.targetDepartmentId));
  const handleDepartmentChange = (index, departmentId) => {
    const department = departments.find((item) => item.id === departmentId);
    updateForm(index, {
      targetDepartmentId: departmentId,
      orderType: forms[index].orderType || department?.name || '',
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-slate-900">Danh sách phiếu chỉ định</h3>
          <p className="text-xs text-slate-400 mt-0.5">Một ca bệnh có thể có nhiều phiếu: xét nghiệm máu, X-Quang, MRI, siêu âm...</p>
          <p className="mt-2 text-[11px] font-bold text-slate-500">Đã gửi: <span className="text-purple-700">{existingOrders.length}</span> phiếu - Đang soạn: <span className="text-blue-700">{forms.length}</span> phiếu</p>
        </div>
        {canOrder && (
          <button type="button" onClick={addForm} className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-2 text-xs font-black text-purple-700 hover:bg-purple-100 transition-all">
            Tạo thêm phiếu chỉ định
          </button>
        )}
      </div>

      {!canOrder ? (
        <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4 text-xs font-semibold text-amber-800">
          <strong>Thông báo:</strong> Bác sĩ cần bấm nút tiếp nhận trạng thái "Bắt đầu khám" ngoài danh sách để kích hoạt quyền tạo chỉ định cận lâm sàng.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          {existingOrders.length > 0 && (
            <div className="rounded-2xl border border-purple-100 bg-purple-50/50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-black text-purple-900">Phiếu chỉ định đã gửi</h4>
                  <p className="text-[11px] font-semibold text-purple-600">Dùng để kiểm tra nhanh, tránh tạo trùng khoa/phòng.</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-purple-700 border border-purple-100">{existingOrders.length} phiếu</span>
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                {existingOrders.map((order) => (
                  <div key={order.id} className="rounded-xl border border-purple-100 bg-white px-3 py-2 text-xs">
                    <strong className="block text-slate-900">{order.orderType}</strong>
                    <span className="mt-0.5 block text-[10px] font-bold text-slate-400">{order.orderCode} - {order.targetDepartment?.name || 'N/A'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {forms.map((form, index) => (
            <div key={index} className="rounded-2xl border border-blue-100 bg-blue-50/30 p-5 shadow-sm relative transition-all">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-sm font-black text-blue-900 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-200 text-[10px] font-black text-blue-800">{index + 1}</span>
                  Soạn phiếu mới
                </h4>
                {forms.length > 1 && (
                  <button type="button" onClick={() => removeForm(index)} className="rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-red-500 hover:bg-red-50 hover:text-red-700 transition-all">
                    Xóa phiếu
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Nơi thực hiện <span className="text-red-500">*</span></label>
                  <select
                    value={form.targetDepartmentId}
                    onChange={(e) => handleDepartmentChange(index, e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                  >
                    <option value="">-- Chọn khoa/phòng cận lâm sàng --</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Tên/Loại chỉ định <span className="text-red-500">*</span></label>
                  <input
                    value={form.orderType}
                    onChange={(e) => updateForm(index, { orderType: e.target.value })}
                    required
                    placeholder="VD: Siêu âm ổ bụng, Chụp X-Quang phổi..."
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Ghi chú lâm sàng cho KTV</label>
                  <input
                    value={form.clinicalNote}
                    onChange={(e) => updateForm(index, { clinicalNote: e.target.value })}
                    placeholder="VD: Nghi ngờ viêm ruột thừa, tập trung kiểm tra hố chậu phải..."
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                </div>
              </div>
            </div>
          ))}

          {hasDuplicateDepartments && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-[11px] font-bold text-red-700">
              Cảnh báo: Đang có sự trùng lặp khoa/phòng thực hiện giữa các phiếu. Vui lòng gộp chung chỉ định vào 1 phiếu hoặc chọn bộ phận khác để tránh lỗi.
            </div>
          )}

          <div className="flex justify-end pt-3">
            <button
              type="submit"
              disabled={busy || hasDuplicateDepartments}
              className="rounded-xl bg-blue-600 px-6 py-3 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-blue-600/30 hover:bg-blue-700 disabled:opacity-50 disabled:shadow-none transition-all"
            >
              {busy ? 'Đang gửi...' : 'Xác nhận & Gửi tất cả phiếu'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function ResultsPanel({ orders }) {
  const completedOrders = orders.filter(o => o.status === 'RESULT_READY' || o.status === 'COMPLETED');
  const pendingOrders = orders.filter(o => !['RESULT_READY', 'COMPLETED', 'CANCELLED'].includes(o.status));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-sm font-black text-slate-900">Chi tiết kết quả trả về</h3>
          <p className="text-[11px] font-semibold text-slate-400 mt-1">Dữ liệu từ phòng Lab và Chẩn đoán hình ảnh.</p>
        </div>
        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600 border border-slate-200">
          Tổng: {orders.length} phiếu
        </span>
      </div>

      {orders.length === 0 ? (
        <Empty title="Chưa có phiếu chỉ định" desc="Bác sĩ chưa tạo bất kỳ phiếu yêu cầu cận lâm sàng nào cho bệnh án này." />
      ) : (
        <div className="space-y-4 mt-4">
          {pendingOrders.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center justify-between">
              <span className="text-xs font-bold text-amber-800">Đang thực hiện {pendingOrders.length} phiếu...</span>
              <LoadingIndicator size="sm" />
            </div>
          )}

          {completedOrders.length > 0 && (
            <div className="space-y-3">
              {completedOrders.map(order => (
                <div key={order.id} className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-4">
                  <div className="flex justify-between items-start mb-3">
                    <strong className="text-xs font-black text-emerald-900">{order.orderType}</strong>
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-1 rounded-md">Đã trả KQ</span>
                  </div>
                  {order.results?.length > 0 ? order.results.map(res => (
                    <div key={res.id} className="mt-2 bg-white rounded-lg border border-emerald-100 p-3 text-xs shadow-sm">
                      {res.note && (
                        <p className="mb-2 text-slate-700"><span className="font-bold text-slate-900">KTV Ghi chú:</span> {res.note}</p>
                      )}
                      {res.files?.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {res.files.map(f => (
                            <a
                              key={f.id}
                              href={f.url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1.5 text-[11px] font-bold text-blue-700 bg-blue-50 px-3 py-2 rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                              Xem {f.originalName?.slice(-12) || 'Tệp đính kèm'}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )) : (
                    <div className="text-xs text-slate-500 italic mt-2">Chưa cập nhật nội dung chi tiết.</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AiPanel({ diagnoses, aiModels, selectedAiModelId, setSelectedAiModelId, selectedAiId, setSelectedAiId, onGenerate, busy }) {
  const currentDiagnosis = diagnoses.find(d => d.id === selectedAiId) || diagnoses[0];
  const parsedResult = parseAiResult(currentDiagnosis?.result);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-slate-900">Trợ lý Phân tích AI</h3>
          <p className="text-[11px] font-semibold text-slate-400 mt-1">Đọc hiểu hồ sơ, tóm tắt và đưa ra phác đồ gợi ý.</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={selectedAiModelId}
          onChange={(e) => setSelectedAiModelId(e.target.value)}
          disabled={busy}
          className="flex-1 rounded-xl border border-slate-200 p-3 text-xs font-semibold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-slate-50 disabled:opacity-50 transition-all"
        >
          {aiModels.map(m => <option key={m.id} value={m.id}>{m.name} ({m.provider})</option>)}
        </select>
        <button
          type="button"
          onClick={onGenerate}
          disabled={busy || !selectedAiModelId}
          className="rounded-xl bg-indigo-600 px-5 py-3 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 disabled:opacity-50 disabled:shadow-none whitespace-nowrap transition-all flex items-center justify-center gap-2"
        >
          {busy ? (
            <>
              <LoadingIndicator size="sm" />
              <span>Đang xử lý...</span>
            </>
          ) : (
            'Yêu cầu AI phân tích'
          )}
        </button>
      </div>

      {diagnoses.length > 0 && (
        <div className="mt-5 space-y-3">
          {diagnoses.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
              {diagnoses.map((d, idx) => (
                <button
                  key={d.id}
                  onClick={() => setSelectedAiId(d.id)}
                  className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border whitespace-nowrap transition-all ${d.id === selectedAiId ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  Bản mẫu {diagnoses.length - idx} ({formatTime(d.createdAt)})
                </button>
              ))}
            </div>
          )}

          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5 text-xs text-slate-800 space-y-4">
            {parsedResult.summary && (
              <div>
                <strong className="text-[11px] uppercase tracking-wider font-black text-indigo-900 block mb-1.5">Tổng quan lâm sàng:</strong>
                <p className="leading-relaxed font-medium text-slate-700">{parsedResult.summary}</p>
              </div>
            )}

            {parsedResult.possibleConditions && (
              <div>
                <strong className="text-[11px] uppercase tracking-wider font-black text-indigo-900 block mb-1.5">Đánh giá nguy cơ (Chẩn đoán sơ bộ):</strong>
                <ul className="list-disc pl-5 space-y-1 font-medium text-slate-700 marker:text-indigo-400">
                  {Array.isArray(parsedResult.possibleConditions) ? parsedResult.possibleConditions.map((c, i) => <li key={i}>{c}</li>) : <li>{parsedResult.possibleConditions}</li>}
                </ul>
              </div>
            )}

            {parsedResult.recommendations && (
              <div>
                <strong className="text-[11px] uppercase tracking-wider font-black text-indigo-900 block mb-1.5">Đề xuất hướng điều trị:</strong>
                <ul className="list-disc pl-5 space-y-1 font-medium text-slate-700 marker:text-indigo-400">
                  {Array.isArray(parsedResult.recommendations) ? parsedResult.recommendations.map((c, i) => <li key={i}>{c}</li>) : <li>{parsedResult.recommendations}</li>}
                </ul>
              </div>
            )}

            {!parsedResult.summary && !parsedResult.possibleConditions && currentDiagnosis?.result && (
              <div className="whitespace-pre-wrap leading-relaxed font-medium text-slate-700">{currentDiagnosis.result}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ConclusionPanel({ form, setForm, onSubmit, busy, completed }) {
  const updateForm = (patch) => setForm({ ...form, ...patch });

  return (
    <div className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-xs">
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label className="block text-[11px] font-black text-emerald-800 mb-1.5 uppercase tracking-wider">Chẩn đoán xác định (Bắt buộc) <span className="text-red-500">*</span></label>
          <textarea
            required
            rows={2}
            value={form.finalDiagnosis}
            onChange={(e) => updateForm({ finalDiagnosis: e.target.value })}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-xs font-semibold outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100 transition-all"
            placeholder="VD: Viêm loét dạ dày tá tràng K27..."
            disabled={completed}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-[11px] font-black text-emerald-800 mb-1.5 uppercase tracking-wider">Hướng điều trị</label>
            <textarea
              rows={3}
              value={form.treatmentPlan}
              onChange={(e) => updateForm({ treatmentPlan: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-xs font-semibold outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100 transition-all"
              placeholder="VD: Điều trị nội khoa ngoại trú, ăn uống kiêng cữ..."
              disabled={completed}
            />
          </div>
          <div>
            <label className="block text-[11px] font-black text-emerald-800 mb-1.5 uppercase tracking-wider">Toa thuốc (Kê đơn)</label>
            <textarea
              rows={3}
              value={form.prescription}
              onChange={(e) => updateForm({ prescription: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-xs font-semibold outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100 transition-all"
              placeholder="VD: 1. Omeprazol 20mg x 14 viên (Ngày 1 viên sáng)..."
              disabled={completed}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-[11px] font-black text-emerald-800 mb-1.5 uppercase tracking-wider">Lời dặn / Hẹn tái khám</label>
            <input
              value={form.followUpNote}
              onChange={(e) => updateForm({ followUpNote: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-xs font-semibold outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100 transition-all"
              placeholder="VD: Tái khám sau 7 ngày hoặc khi đau bụng dữ dội."
              disabled={completed}
            />
          </div>
          <div>
            <label className="block text-[11px] font-black text-emerald-800 mb-1.5 uppercase tracking-wider">Ghi chú ẩn (Lưu hành nội bộ BS)</label>
            <input
              value={form.doctorNote}
              onChange={(e) => updateForm({ doctorNote: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-xs font-semibold outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100 transition-all"
              placeholder="Ghi chú thêm về cơ địa, đặc điểm tâm lý bệnh nhân..."
              disabled={completed}
            />
          </div>
        </div>

        <div className="flex justify-end pt-5 mt-2 border-t border-slate-100">
          <button
            type="submit"
            disabled={busy || completed}
            className={`rounded-xl px-8 py-3.5 text-xs font-black uppercase tracking-wider text-white shadow-lg transition-all ${completed
              ? 'bg-slate-300 shadow-none text-slate-500 cursor-not-allowed'
              : 'bg-emerald-600 shadow-emerald-600/30 hover:bg-emerald-700 disabled:opacity-50 disabled:shadow-none'
              }`}
          >
            {busy ? 'Đang lưu dữ liệu...' : completed ? 'Hồ sơ đã đóng' : 'Hoàn Tất & Đóng Bệnh Án'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Info({ label, value, large }) {
  return (
    <div className={`rounded-2xl border border-slate-100 bg-slate-50/50 p-4 ${large ? 'col-span-full' : ''}`}>
      <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</span>
      <span className={`block mt-1 font-bold text-slate-900 ${large ? 'text-sm' : 'text-xs'}`}>{value}</span>
    </div>
  );
}

function Alert({ tone, message }) {
  const isSuccess = tone === 'success';
  return (
    <div className={`p-4 rounded-2xl border text-xs font-black shadow-sm ${isSuccess ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
      {message}
    </div>
  );
}

function Empty({ title, desc }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center bg-slate-50/30 rounded-2xl">
      <div className="h-14 w-14 rounded-full bg-white border border-slate-100 shadow-sm flex items-center justify-center mb-4 text-slate-300">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <h3 className="text-sm font-black text-slate-900">{title}</h3>
      <p className="mt-1 text-xs font-semibold text-slate-500 max-w-sm mx-auto">{desc}</p>
    </div>
  );
}
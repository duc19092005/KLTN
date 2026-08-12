import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, FileText, Printer, Stethoscope, Search, RefreshCw, CheckCircle2, Clock, Activity, AlertCircle, Sparkles, User, Building2, ChevronRight, ChevronDown, X, UserCheck, ShieldCheck, History, Pill } from 'lucide-react';
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
import { useToast } from '../../../providers/ToastProvider';
import { useBodyScrollLock } from '../../../shared/hooks/useBodyScrollLock';

const STATUS = {
  WAITING: { label: 'Chờ khám', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-400' },
  IN_PROGRESS: { label: 'Tạo chỉ định lâm sàng', color: 'bg-sky-50 text-sky-700 border-sky-200', dot: 'bg-sky-500' },
  WAITING_TEST_RESULT: { label: 'Chờ kết quả cận lâm sàng', color: 'bg-sky-50 text-sky-700 border-sky-200', dot: 'bg-sky-500' },
  WAITING_CONCLUSION: { label: 'Chờ kết luận', color: 'bg-sky-50 text-sky-700 border-sky-200', dot: 'bg-sky-500' },
  COMPLETED: { label: 'Hoàn tất', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  CANCELLED: { label: 'Đã hủy', color: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
};

const FILTERS = [
  { id: '', label: 'Tất cả' },
  { id: 'WAITING', label: 'Chờ khám' },
  { id: 'IN_PROGRESS', label: 'Tạo chỉ định lâm sàng' },
  { id: 'WAITING_TEST_RESULT', label: 'Chờ XN/Cận lâm sàng' },
  { id: 'WAITING_CONCLUSION', label: 'Chờ kết luận' },
  { id: 'COMPLETED', label: 'Hoàn tất' },
];

const emptyOrder = { targetDepartmentId: '', orderType: '', priority: 'NORMAL', clinicalNote: '' };
const emptyConclusion = { finalDiagnosis: '', treatmentPlan: '', prescription: '', followUpNote: '', doctorNote: '' };

function getItems(data) { return Array.isArray(data) ? data : data?.items || []; }
function formatDate(value) { return value ? new Date(value).toLocaleDateString('vi-VN') : 'Chưa cập nhật'; }
function formatTime(value) { return value ? new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--'; }
function parseAiResult(value) { try { return JSON.parse(value || '{}'); } catch { return { summary: value }; } }
function getVisitDepartmentName(visit) { return visit?.department?.name || visit?.department?.departmentCode || 'Chưa có phòng'; }
function getVisitStaffName(visit) { return visit?.staff?.fullName || visit?.staff?.user?.username || 'Chưa phân công'; }
function getQueueActionLabel(status) {
  if (status === 'IN_PROGRESS') return 'Tạo chỉ định lâm sàng';
  if (status === 'WAITING_TEST_RESULT') return 'Tạo thêm chỉ định';
  if (status === 'WAITING_CONCLUSION') return 'Xem KQ & kết luận';
  return 'Mở hồ sơ';
}

function printConclusionWithQR(visit, conclusion, qrData) {
  const printWindow = window.open('', '_blank');
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;
  const qrCodeHtml = `<div style="text-align: center; margin-top: 20px; padding: 15px; border: 2px solid #0284c7; border-radius: 10px; background: #f0f9ff;">
    <h3 style="color: #0369a1; font-family: Arial, sans-serif; margin-bottom: 15px;">Mã xác minh bệnh án</h3>
    <img src="${qrUrl}" alt="QR Code" style="width: 150px; height: 150px;" />
    <p style="color: #0369a1; font-size: 11px; margin-top: 10px; font-family: monospace;">${qrData}</p>
    <p style="color: #0369a1; font-size: 12px; margin-top: 10px;">Quét để xác minh tính xác thực của hồ sơ</p>
  </div>`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Bệnh án - ${visit?.visitCode}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #0284c7; padding-bottom: 20px; }
        .header h1 { color: #0369a1; margin: 0; }
        .header h2 { color: #0369a1; font-size: 14px; margin-top: 5px; }
        .section { margin-bottom: 20px; }
        .section h3 { color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-top: 0; }
        .label { font-weight: bold; color: #64748b; margin-top: 10px; display: block; font-size: 12px; }
        .value { color: #1e293b; margin-top: 5px; white-space: pre-wrap; font-size: 13px; }
        .meta { color: #64748b; font-size: 11px; margin-top: 5px; }
        @media print {
          .no-print { display: none; }
          .print-area { margin: 0; padding: 20px; }
        }
      </style>
    </head>
    <body>
      <div class="print-area">
        <div class="header">
          <h1>PHÒNG KHÁM BỆNH VIỆN KLTN</h1>
          <h2>Hệ thống quản lý bệnh án điện tử</h2>
        </div>

        <div class="section">
          <h3>THÔNG TIN BỆNH NHÂN</h3>
          <span class="label">Họ tên:</span>
          <span class="value">${visit?.patient?.fullName || 'N/A'}</span>
          <span class="label">Mã bệnh nhân:</span>
          <span class="value">${visit?.patient?.patientCode || 'N/A'}</span>
          <span class="label">Ngày sinh:</span>
          <span class="value">${visit?.patient?.birthDate ? new Date(visit.patient.birthDate).toLocaleDateString('vi-VN') : 'N/A'}</span>
          <span class="label">Giới tính:</span>
          <span class="value">${visit?.patient?.gender === 'MALE' ? 'Nam' : visit?.patient?.gender === 'FEMALE' ? 'Nữ' : 'N/A'}</span>
          <span class="label">Số điện thoại:</span>
          <span class="value">${visit?.patient?.phone || 'N/A'}</span>
          <span class="label">CCCD:</span>
          <span class="value">${visit?.patient?.citizenId || 'N/A'}</span>
        </div>

        <div class="section">
          <h3>THÔNG TIN LƯỢT KHÁM</h3>
          <span class="label">Mã lượt khám:</span>
          <span class="value">${visit?.visitCode || 'N/A'}</span>
          <span class="label">Ngày khám:</span>
          <span class="value">${visit?.checkInAt ? new Date(visit.checkInAt).toLocaleDateString('vi-VN') + ' ' + new Date(visit.checkInAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span>
          <span class="label">Phòng khám:</span>
          <span class="value">${getVisitDepartmentName(visit)}</span>
          <span class="label">Bác sĩ:</span>
          <span class="value">${getVisitStaffName(visit)}</span>
        </div>

        <div class="section">
          <h3>KẾT LUẬN BÁC SĨ</h3>
          <span class="label">Chẩn đoán xác định:</span>
          <span class="value">${conclusion?.finalDiagnosis || 'Chưa có chẩn đoán'}</span>
          <span class="label">Hướng điều trị:</span>
          <span class="value">${conclusion?.treatmentPlan || 'Chưa có hướng điều trị'}</span>
          <span class="label">Toa thuốc:</span>
          <span class="value">${conclusion?.prescription || 'Chưa có toa thuốc'}</span>
          <span class="label">Lời dặn:</span>
          <span class="value">${conclusion?.followUpNote || 'Chưa có lời dặn'}</span>
        </div>

        ${qrCodeHtml}

        <div class="section no-print" style="text-align: center; margin-top: 30px; padding: 20px;">
          <button onclick="window.print()" style="background: #0284c7; color: white; padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; margin: 0 5px;">
            🖨️ In hồ sơ
          </button>
          <button onclick="window.close()" style="background: #64748b; color: white; padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; margin: 0 5px;">
            Đóng
          </button>
        </div>
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}

export default function DoctorQueuePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [visits, setVisits] = useState([]);
  const [activeVisit, setActiveVisit] = useState(null);
  const [decision, setDecision] = useState(null);
  const [medicalHistory, setMedicalHistory] = useState([]);
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

  const [showRatingPopup, setShowRatingPopup] = useState(false);
  const [ratingModelId, setRatingModelId] = useState('');
  const [ratingModelName, setRatingModelName] = useState('');
  const [countdown, setCountdown] = useState(10);
  const [ratingFeedback, setRatingFeedback] = useState('');
  const [ratingSelected, setRatingSelected] = useState(null);
  const [pauseCountdown, setPauseCountdown] = useState(false);

  useBodyScrollLock(showWorkflowModal || showRatingPopup);

  const loadVisits = async () => {
    setLoading(true);
    try {
      const res = await doctorVisitService.list(filter ? { status: filter, limit: 50 } : { limit: 50 });
      const items = getItems(res.data);
      setVisits(items);
      setActiveVisit((current) => current ? (items.find((v) => v.id === current.id) || items[0] || null) : (items[0] || null));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không tải được hàng đợi khám');
    } finally { setLoading(false); }
  };

  const reloadVisitsSilently = async () => {
    try {
      const res = await doctorVisitService.list(filter ? { status: filter, limit: 50 } : { limit: 50 });
      const items = getItems(res.data);
      setVisits(items);
      setActiveVisit((current) => {
        if (!current) return items[0] || null;
        const found = items.find((v) => v.id === current.id);
        return found ? { ...current, ...found } : current;
      });
    } catch (err) {
      console.error('Failed to silently reload queue:', err);
    }
  };

  const loadDecision = async (visitId) => {
    if (!visitId) return;
    setDetailLoading(true);
    try {
      const patientId = activeVisit?.id === visitId ? activeVisit.patientId : undefined;
      const [decisionRes, historyResult] = await Promise.all([
        clinicalDecisionService.getVisitResults(visitId),
        patientId
          ? clinicalDecisionService.getPatientMedicalHistory(patientId, visitId).then((res) => ({ res })).catch((error) => ({ error }))
          : Promise.resolve({ res: { data: [] } }),
      ]);
      const res = decisionRes;
      setDecision(res.data);
      if (historyResult.error) {
        setMedicalHistory([]);
        toast.error(historyResult.error.response?.data?.message || 'Không tải được bệnh án lịch sử.');
      } else {
        setMedicalHistory(getItems(historyResult.res.data));
      }
      const latestAi = res.data?.aiDiagnoses?.[0];
      setSelectedAiId(latestAi?.id || '');

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
      setMedicalHistory([]);
      toast.error(err.response?.data?.message || 'Không tải được hồ sơ lượt khám.');
    } finally { setDetailLoading(false); }
  };

  useEffect(() => { loadVisits(); }, [filter]);
  useEffect(() => { if (activeVisit?.id) { loadDecision(activeVisit.id); setShowWorkflowModal(false); } }, [activeVisit?.id]);

  useEffect(() => {
    const handleNotification = (e) => {
      const payload = e.detail;
      if (payload.title === 'Lượt khám mới' || payload.title === 'Có kết quả cận lâm sàng') {
        reloadVisitsSilently();
        if (activeVisit?.id) {
          loadDecision(activeVisit.id);
        }
      }
    };

    window.addEventListener('app:notification-received', handleNotification);
    return () => window.removeEventListener('app:notification-received', handleNotification);
  }, [filter, activeVisit?.id]);

  useEffect(() => {
    (async () => {
      try {
        const res = await departmentService.list({ canReceiveOrders: true, status: 'ACTIVE', limit: 100 });
        const items = getItems(res.data).filter((department) => ['LABORATORY', 'IMAGING'].includes(department.type));
        if (!items.length) {
          toast.info('Chưa có phòng xét nghiệm/chẩn đoán hình ảnh nào được bật "Nhận phiếu chỉ định".', 8000);
        }
        setDepartments(items);
      } catch (err) {
        toast.error('Không thể tải danh sách khoa/phòng. Vui lòng thử lại.');
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    aiModelService.availableForDiagnosis()
      .then((res) => {
        if (cancelled) return;
        const items = getItems(res.data);
        setAiModels(items);
        setSelectedAiModelId((current) => current || items[0]?.id || '');
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err?.response?.data?.message || 'Không tải được danh sách mô hình AI cho chẩn đoán.');
      });
    return () => { cancelled = true; };
  }, []);

  const filteredVisits = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return visits;
    return visits.filter((visit) => [visit.visitCode, visit.patient?.patientCode, visit.patient?.fullName, visit.patient?.phone, visit.patient?.citizenId, getVisitDepartmentName(visit), getVisitStaffName(visit)].filter(Boolean).some((field) => field.toLowerCase().includes(text)));
  }, [query, visits]);

  const pageSize = 6;
  const totalPages = Math.max(1, Math.ceil(filteredVisits.length / pageSize));
  const pagedVisits = useMemo(() => filteredVisits.slice((page - 1) * pageSize, page * pageSize), [filteredVisits, page]);
  useEffect(() => { setPage(1); }, [filter, query]);

  const submitOrder = async (event) => {
    event.preventDefault();
    if (!activeVisit) return;
    setBusy(true);
    try {
      const validOrders = orderForms.filter((item) => item.orderType.trim() && item.targetDepartmentId);
      if (!validOrders.length) {
        toast.error('Vui lòng nhập ít nhất 1 phiếu chỉ định hợp lệ.');
        return;
      }
      const duplicateDepartmentId = validOrders.find((item, index) => validOrders.findIndex((other) => other.targetDepartmentId === item.targetDepartmentId) !== index)?.targetDepartmentId;
      if (duplicateDepartmentId) {
        const duplicatedDepartment = departments.find((department) => department.id === duplicateDepartmentId);
        toast.error(`Bạn đã chọn khoa/phòng "${duplicatedDepartment?.name || duplicateDepartmentId}" rồi. Vui lòng chọn khoa/phòng khác để tránh trùng phiếu chỉ định.`);
        return;
      }
      await Promise.all(validOrders.map((item) => medicalOrderService.create({ ...item, visitId: activeVisit.id, targetDepartmentId: item.targetDepartmentId || undefined })));
      toast.success('Đã tạo và gửi chỉ định cận lâm sàng thành công.');
      setOrderForms([{ ...emptyOrder }]);
      await Promise.all([loadVisits(), loadDecision(activeVisit.id)]);
    } catch (err) { toast.error(err.response?.data?.message || 'Không tạo được chỉ định'); }
    finally { setBusy(false); }
  };

  const startVisit = async (targetVisit = activeVisit) => {
    if (!targetVisit) return;
    setActiveVisit(targetVisit);
    setBusy(true);
    try {
      await doctorVisitService.updateStatus(targetVisit.id, 'IN_PROGRESS');
      toast.success('Đã tiếp nhận bệnh nhân. Hệ thống chuyển sang bước tạo chỉ định lâm sàng.');
      await Promise.all([loadVisits(), loadDecision(targetVisit.id)]);
      setActiveStep(1);
      setShowWorkflowModal(true);
    } catch (err) { toast.error(err.response?.data?.message || 'Không thể bắt đầu khám'); }
    finally { setBusy(false); }
  };

  const generateAi = async () => {
    if (!activeVisit) return;
    setBusy(true);
    try {
      const res = await clinicalDecisionService.generateAiAnalysis({ visitId: activeVisit.id, aiModelId: selectedAiModelId || undefined });
      setSelectedAiId(res.data.id);
      toast.success('AI đã phân tích dữ liệu lâm sàng thành công.');
      await loadDecision(activeVisit.id);
    } catch (err) { toast.error(err.response?.data?.message || 'Không tạo được phân tích AI'); }
    finally { setBusy(false); }
  };

  const submitConclusion = async (event) => {
    event.preventDefault();
    if (!activeVisit) return;
    setBusy(true);
    try {
      const res = await clinicalDecisionService.createConclusion({ ...conclusionForm, visitId: activeVisit.id, aiDiagnosisId: selectedAiId || undefined });
      toast.success('Đã đóng hồ sơ bệnh án và hoàn tất lượt khám của bệnh nhân.');
      setShowWorkflowModal(false);

      // Resolve the AI diagnosis used for this conclusion. createConclusion
      // returns conclusion.aiDiagnosis (single); getVisitResults returns an
      // aiDiagnoses array. Prefer the selected one, fall back to latest.
      const concluded = res?.data || (await loadDecisionData(activeVisit.id)) || {};
      const usedDiagnosis =
        concluded?.aiDiagnosis ||
        concluded?.aiDiagnoses?.find((d) => d.id === selectedAiId) ||
        concluded?.aiDiagnoses?.[0];
      const usedModel = usedDiagnosis?.aiModel;

      // Always reload visits and decision state immediately so status updates back cleanly
      await Promise.all([
        loadVisits(),
        loadDecision(activeVisit.id),
      ]);

      if (usedModel) {
        setRatingModelId(usedModel.id);
        setRatingModelName(usedModel.modelName || usedModel.name || 'Mô hình AI');
        setShowRatingPopup(true);
        setCountdown(10);
        setRatingSelected(null);
        setRatingFeedback('');
        setPauseCountdown(false);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không lưu được kết luận cuối');
      await Promise.all([
        loadVisits(),
        loadDecision(activeVisit.id),
      ]);
    } finally {
      setBusy(false);
    }
  };

  const loadDecisionData = async (visitId) => {
    if (!visitId) return null;
    try {
      const res = await clinicalDecisionService.getVisitResults(visitId);
      return res.data;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (!showRatingPopup || pauseCountdown) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setShowRatingPopup(false);
          loadVisits();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [showRatingPopup, pauseCountdown]);

  const handleRateModel = async (satisfied) => {
    try {
      setBusy(true);
      await aiModelService.rate(ratingModelId, {
        aiDiagnosisId: selectedAiId,
        satisfied,
        feedback: satisfied ? undefined : ratingFeedback,
      });
      toast.success('Cảm ơn bác sĩ đã đánh giá mô hình AI!');
    } catch (err) {
      toast.error('Không gửi được đánh giá.');
    } finally {
      setBusy(false);
      setShowRatingPopup(false);
      setRatingSelected(null);
      setRatingFeedback('');
      setPauseCountdown(false);
      await loadVisits();
    }
  };

  return (
    <DashboardLayout user={user} navItems={DOCTOR_NAV_ITEMS} activeItem="queue" onNavigate={(id) => navigateDoctor(navigate, id)} onLogout={logout}>
      <div className="max-w-[1600px] mx-auto space-y-6 pb-12 antialiased">
        {/* HERO BANNER */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-sky-50/80 blur-2xl pointer-events-none" />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-lg shadow-sky-600/25 shrink-0">
                <Stethoscope className="w-6 h-6" strokeWidth={2} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-sky-600 bg-sky-50 px-2.5 py-0.5 rounded-md border border-sky-100">
                    Phân hệ Bác sĩ
                  </span>
                  <span className="text-xs font-semibold text-slate-400">• Điều trị lâm sàng</span>
                </div>
                <h1 className="mt-1 text-2xl font-bold text-slate-900 tracking-tight">
                  Hàng đợi khám & Chẩn đoán bệnh
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => loadVisits()}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 flex items-center gap-2 transition-colors"
              >
                <RefreshCw className="w-4 h-4 text-slate-500" />
                <span>Làm mới hàng đợi</span>
              </button>
            </div>
          </div>
        </section>

        {/* QUEUE LIST TABLE */}
        <QueueList
          query={query}
          setQuery={setQuery}
          filter={filter}
          setFilter={setFilter}
          loading={loading}
          visits={pagedVisits}
          activeVisit={activeVisit}
          setActiveVisit={setActiveVisit}
          page={page}
          setPage={setPage}
          totalPages={totalPages}
          totalItems={filteredVisits.length}
          busy={busy}
          onStart={startVisit}
          onOpenWorkflow={(visit) => {
            setActiveVisit(visit);
            setActiveStep(['IN_PROGRESS', 'WAITING_TEST_RESULT'].includes(visit.status) ? 1 : 2);
            setShowWorkflowModal(true);
          }}
        />

        {/* WORKFLOW WIZARD MODAL */}
        {showWorkflowModal && activeVisit && (
          <WorkflowModal
            visit={decision || activeVisit}
            activeStep={activeStep}
            setActiveStep={setActiveStep}
            onClose={() => setShowWorkflowModal(false)}
            orderProps={{ forms: orderForms, setForms: setOrderForms, departments, existingOrders: decision?.medicalOrders || [], onSubmit: submitOrder, busy }}
            resultProps={{ orders: decision?.medicalOrders || [] }}
            aiProps={{ diagnoses: decision?.aiDiagnoses || [], aiModels, selectedAiModelId, setSelectedAiModelId, selectedAiId, setSelectedAiId, onGenerate: generateAi, busy }}
            conclusionProps={{ form: conclusionForm, setForm: setConclusionForm, onSubmit: submitConclusion, busy, completed: Boolean(decision?.finalConclusion), activeVisit, activeConclusion: conclusionForm }}
            history={medicalHistory}
          />
        )}

        {/* AI RATING POPUP */}
        {showRatingPopup && createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs animate-fadeIn" />
            <div className="relative z-10 w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xl space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest font-black text-sky-600 bg-sky-50 px-2.5 py-1 rounded-md border border-sky-100">
                  Đánh giá Mô hình AI
                </span>
                {!pauseCountdown && (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100">
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                    Tự động đóng trong {countdown}s
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">Bác sĩ có hài lòng với kết quả của mô hình AI?</h3>
                <p className="text-xs text-slate-500 font-medium">
                  Mô hình: <span className="text-slate-900 font-bold">{ratingModelName}</span>
                </p>
              </div>

              {ratingSelected === null ? (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleRateModel(true)}
                    className="flex flex-col items-center justify-center py-4 px-3 rounded-2xl border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold transition-colors text-xs gap-1.5"
                  >
                    Hài lòng (Chính xác)
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setRatingSelected('NO');
                      setPauseCountdown(true);
                    }}
                    className="flex flex-col items-center justify-center py-4 px-3 rounded-2xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold transition-colors text-xs gap-1.5"
                  >
                    Chưa chính xác
                  </button>
                </div>
              ) : (
                <div className="space-y-4 animate-fadeIn">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                      Lý do mô hình đánh giá chưa chuẩn xác <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      value={ratingFeedback}
                      onChange={(e) => setRatingFeedback(e.target.value)}
                      placeholder="VD: Mô hình bỏ sót bóng mờ ở đáy phổi trái..."
                      rows={3}
                      className="w-full resize-none rounded-xl border border-slate-200 p-3 text-xs outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition-all font-medium"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRatingSelected(null);
                        setPauseCountdown(false);
                      }}
                      className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      Quay lại
                    </button>
                    <button
                      type="button"
                      disabled={busy || !ratingFeedback.trim()}
                      onClick={() => handleRateModel(false)}
                      className="flex-1 rounded-xl bg-sky-600 py-2.5 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-50 transition-colors"
                    >
                      Gửi phản hồi
                    </button>
                  </div>
                </div>
              )}

              <div className="border-t border-slate-100 pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowRatingPopup(false);
                    setRatingSelected(null);
                    setRatingFeedback('');
                    setPauseCountdown(false);
                    loadVisits();
                  }}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Bỏ qua đánh giá (Đóng)
                </button>
              </div>
            </div>
          </div>,
          document.body
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
    <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm antialiased">
      <div className="space-y-4 border-b border-slate-100 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-sky-600">Hàng đợi lâm sàng</p>
            <h2 className="text-lg font-bold text-slate-900">Danh sách bệnh nhân tiếp nhận</h2>
            <p className="mt-0.5 text-xs font-semibold text-slate-400">Lọc nhanh theo trạng thái hoặc thông tin bệnh nhân.</p>
          </div>
          <div className="w-fit rounded-full border border-sky-200 bg-sky-50 px-3.5 py-1 text-xs font-bold text-sky-700">
            Tổng số: {totalItems} ca khám
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(280px,1fr)_auto]">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm tên bệnh nhân, mã BN, CCCD hoặc số điện thoại..."
              className="h-11 w-full pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 xl:max-w-[720px] scrollbar-thin">
            {FILTERS.map((item) => (
              <button
                type="button"
                key={item.id || 'ALL'}
                onClick={() => setFilter(item.id)}
                className={`whitespace-nowrap rounded-xl border px-3.5 py-2 text-xs font-bold transition-all ${
                  filter === item.id ? 'border-sky-600 bg-sky-600 text-white shadow-xs' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="ui-table min-w-full text-left">
          <thead className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-6 py-3.5">Bệnh nhân</th>
              <th className="px-6 py-3.5">Mã lượt</th>
              <th className="px-6 py-3.5">Phòng khám</th>
              <th className="px-6 py-3.5">Giờ tiếp nhận</th>
              <th className="px-6 py-3.5">Trạng thái</th>
              <th className="px-6 py-3.5 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-12">
                  <LoadingIndicator size="md" label="Đang cập nhật danh sách..." />
                </td>
              </tr>
            ) : visits.map((visit) => (
              <VisitRow
                key={visit.id}
                visit={visit}
                active={activeVisit?.id === visit.id}
                busy={busy}
                onSelect={() => setActiveVisit(visit)}
                onStart={() => onStart(visit)}
                onOpenWorkflow={() => onOpenWorkflow(visit)}
              />
            ))}
            {!loading && !visits.length && (
              <tr>
                <td colSpan={6} className="p-8">
                  <Empty title="Không tìm thấy lượt khám" desc="Không có hồ sơ nào trùng khớp với bộ lọc hoặc từ khóa hiện tại." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-100 bg-white px-6 py-4 text-xs sm:flex-row sm:items-center sm:justify-between">
        <span className="font-bold text-slate-500">
          Trang <strong className="text-slate-900">{page}</strong> / {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
          >
            Trang trước
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
          >
            Trang sau
          </button>
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
    <tr className="bg-white transition-colors hover:bg-sky-50/30">
      <td className="min-w-[260px] px-6 py-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 shrink-0 rounded-2xl bg-sky-100 text-sky-700 font-bold text-xs flex items-center justify-center border border-sky-200">
            {(visit.patient?.fullName || 'BN').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-xs font-bold text-slate-900">{visit.patient?.fullName || 'Chưa có tên'}</h3>
            <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{visit.patient?.patientCode || 'N/A'} • {visit.patient?.phone || 'Không có SĐT'}</p>
          </div>
        </div>
      </td>
      <td className="whitespace-nowrap px-6 py-4">
        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-mono font-bold text-slate-700 border border-slate-200/60">
          {visit.visitCode}
        </span>
      </td>
      <td className="whitespace-nowrap px-6 py-4 text-xs font-bold text-slate-800">{getVisitDepartmentName(visit)}</td>
      <td className="whitespace-nowrap px-6 py-4 text-xs font-medium text-slate-500">{formatTime(visit.checkInAt)}</td>
      <td className="whitespace-nowrap px-6 py-4">
        <div className="flex items-center gap-2">
          {active && <span className="h-6 w-1 rounded-full bg-sky-500" />}
          <StatusBadge status={st} />
        </div>
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex justify-end gap-2">
          {canStart && (
            <button
              type="button"
              disabled={busy}
              onClick={onStart}
              className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-sky-700 disabled:opacity-50 transition-all"
            >
              Bắt đầu khám
            </button>
          )}
          {canOpenWorkflow && (
            <button
              type="button"
              disabled={busy}
              onClick={onOpenWorkflow}
              className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-bold text-sky-700 shadow-xs hover:bg-sky-100 disabled:opacity-50 transition-all"
            >
              {getQueueActionLabel(visit.status)}
            </button>
          )}
          {!canStart && !canOpenWorkflow && (
            <span className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-bold text-slate-400">
              Đã hoàn tất
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${status.color}`}>
      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${status.dot}`} />
      {status.label}
    </span>
  );
}

/* ==========================================
   MODAL WIZARD STEP-BY-STEP CHUẨN HÓA KHÁM BỆNH
   ========================================== */
function WorkflowModal({ visit, activeStep, setActiveStep, onClose, orderProps, resultProps, aiProps, conclusionProps, history = [] }) {
  const orders = orderProps?.existingOrders || [];
  const readyOrders = orders.filter((order) => order.status === 'RESULT_READY');
  const pendingOrders = orders.filter((order) => ['ORDERED', 'IN_PROGRESS'].includes(order.status));
  const hasConclusion = Boolean(conclusionProps?.completed || visit.finalConclusion);
  const canCreateOrders = ['IN_PROGRESS', 'WAITING_TEST_RESULT', 'WAITING_CONCLUSION'].includes(visit?.status);
  const canReviewResults = orders.length > 0 || ['WAITING_TEST_RESULT', 'WAITING_CONCLUSION', 'COMPLETED'].includes(visit?.status);
  const canConclude = pendingOrders.length === 0 && (readyOrders.length > 0 || visit?.status === 'WAITING_CONCLUSION' || hasConclusion);

  const steps = [
    {
      step: 1,
      eyebrow: 'Bước 01',
      title: 'Khám lâm sàng & chỉ định cận lâm sàng',
      desc: 'Tạo phiếu xét nghiệm, X-Quang, siêu âm hoặc chẩn đoán hình ảnh.',
      status: pendingOrders.length ? `Có thể bổ sung (${pendingOrders.length} phiếu chờ)` : orders.length ? `${orders.length} phiếu đã gửi` : canCreateOrders ? 'Sẵn sàng tạo phiếu' : 'Chưa tiếp nhận khám',
      tone: 'sky',
      enabled: true,
    },
    {
      step: 2,
      eyebrow: 'Bước 02',
      title: 'Đọc kết quả & tham vấn AI',
      desc: 'Kiểm tra tệp kết quả trả về, sau đó chạy AI nếu cần hỗ trợ phân tích.',
      status: pendingOrders.length ? `Còn ${pendingOrders.length} phiếu đang xử lý` : readyOrders.length ? `${readyOrders.length} phiếu có kết quả` : 'Chưa có kết quả',
      tone: 'sky',
      enabled: canReviewResults,
    },
    {
      step: 3,
      eyebrow: 'Bước 03',
      title: 'Kết luận, toa thuốc & đóng bệnh án',
      desc: 'Nhập chẩn đoán cuối, hướng điều trị, toa thuốc và hẹn tái khám.',
      status: hasConclusion ? 'Hồ sơ đã đóng' : canConclude ? 'Có thể kết luận' : 'Cần kết quả cận lâm sàng trước',
      tone: 'emerald',
      enabled: canConclude,
    },
    {
      step: 4,
      eyebrow: 'Hồ sơ tham khảo',
      title: 'Bệnh án lịch sử',
      desc: 'Đối chiếu chẩn đoán, điều trị và kết quả từ các lần khám trước.',
      status: history.length ? `${history.length} lượt khám trước` : 'Chưa có tiền sử khám',
      tone: 'indigo',
      enabled: true,
    },
  ];

  const goStep = (step) => {
    const target = steps.find((item) => item.step === step);
    if (target?.enabled) setActiveStep(step);
  };

  const currentStep = steps.find((item) => item.step === activeStep) || steps[0];

  if (typeof document === 'undefined' || !document.body) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 antialiased">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs animate-fadeIn" />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-[1320px] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* MODAL HEADER */}
        <div className="shrink-0 border-b border-slate-100 px-6 py-5 bg-white">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-sky-600">Bệnh án điện tử</p>
              <h2 className="mt-0.5 truncate text-lg font-bold text-slate-900">
                {visit.patient?.fullName} <span className="text-slate-400 font-semibold">({visit.visitCode})</span>
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 grid place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors text-lg"
            >
              ×
            </button>
          </div>

          {/* STEPPER NAV */}
          <div className="mt-4 flex items-center justify-center gap-3">
            {steps.map((step, index) => {
              const isCurrent = activeStep === step.step;
              const isDone = step.step < activeStep || (step.step === 3 && hasConclusion);
              const circleClass = isCurrent
                ? step.step === 4
                  ? 'bg-indigo-600 text-white border-indigo-600 ring-4 ring-indigo-100 shadow-sm'
                  : 'bg-sky-600 text-white border-sky-600 ring-4 ring-sky-100 shadow-sm'
                : isDone
                ? 'bg-sky-100 text-sky-700 border-sky-200'
                : step.enabled
                ? 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                : 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed';
              return (
                <React.Fragment key={step.step}>
                  <button
                    id={`doctor-workflow-step-${step.step}`}
                    type="button"
                    onClick={() => goStep(step.step)}
                    disabled={!step.enabled}
                    aria-label={step.step === 4 ? 'Mở bệnh án lịch sử' : `Bước ${step.step}`}
                    aria-current={isCurrent ? 'step' : undefined}
                    className={`flex h-9 min-w-9 items-center justify-center rounded-full border px-2.5 text-xs font-bold transition-all ${circleClass}`}
                  >
                    {step.step === 4 ? <History className="h-4 w-4" aria-hidden="true" /> : step.step}
                  </button>
                  {index < steps.length - 1 && <span className="h-0.5 w-12 bg-slate-200" />}
                </React.Fragment>
              );
            })}
          </div>

          <h3 className="mt-3 text-center text-sm font-bold text-slate-900">{currentStep.title}</h3>
        </div>

        {/* STEPPER CONTENT AREA */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6">
          {activeStep === 1 && (
            <div className="space-y-5 animate-fadeIn">
              <OrderPanel visit={visit} {...orderProps} />
              <WorkflowActions
                primaryLabel="Sang bước 2 (Đọc kết quả)"
                onPrimary={() => goStep(2)}
                primaryDisabled={!canReviewResults}
                primaryHint={!canReviewResults ? 'Cần tạo ít nhất một phiếu chỉ định trước.' : ''}
              />
            </div>
          )}

          {activeStep === 2 && (
            <div className="space-y-5 animate-fadeIn">
              <ResultsPanel {...resultProps} />
              <AiPanel {...aiProps} />
              <WorkflowActions
                secondaryLabel="Quay lại bước 1"
                onSecondary={() => goStep(1)}
                extraLabel="Yêu cầu bổ sung"
                onExtra={() => goStep(1)}
                primaryLabel="Sang bước 3 (Kết luận)"
                onPrimary={() => goStep(3)}
                primaryDisabled={!canConclude}
                primaryHint={!canConclude ? (pendingOrders.length ? `Còn ${pendingOrders.length} phiếu đang chờ kết quả.` : 'Cần có kết quả cận lâm sàng trước.') : ''}
              />
            </div>
          )}

          {activeStep === 3 && (
            <div className="space-y-5 animate-fadeIn">
              <ConclusionPanel {...conclusionProps} />
              <WorkflowActions secondaryLabel="Xem lại bước 2" onSecondary={() => goStep(2)} />
            </div>
          )}

          {activeStep === 4 && (
            <div className="animate-fadeIn">
              <MedicalHistoryPanel history={history} />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function MedicalHistoryPanel({ history }) {
  const [openVisitId, setOpenVisitId] = useState(history[0]?.id || '');

  useEffect(() => {
    setOpenVisitId((current) => history.some((visit) => visit.id === current) ? current : history[0]?.id || '');
  }, [history]);

  const diagnosisCount = history.filter((visit) => visit.finalConclusion?.finalDiagnosis).length;
  const aiDiagnosisCount = history.reduce((total, visit) => total + (visit.aiDiagnoses?.length || 0), 0);
  const resultCount = history.reduce(
    (total, visit) => total + (visit.medicalOrders || []).reduce((orderTotal, order) => orderTotal + (order.results?.length || 0), 0),
    0
  );

  return (
    <section aria-labelledby="medical-history-title" className="overflow-hidden rounded-3xl border border-indigo-200/80 bg-white shadow-sm">
      <div className="relative overflow-hidden border-b border-indigo-100 bg-gradient-to-br from-indigo-950 via-slate-900 to-sky-950 px-6 py-6 text-white">
        <div className="absolute -right-8 -top-12 h-36 w-36 rounded-full border border-white/10 bg-indigo-400/10" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-indigo-200">
              <History className="h-4 w-4" aria-hidden="true" />
              <span className="text-[10px] font-extrabold uppercase tracking-[0.2em]">Hồ sơ tham khảo lâm sàng</span>
            </div>
            <h3 id="medical-history-title" className="mt-2 text-xl font-bold tracking-tight">Bệnh án lịch sử</h3>
            <p className="mt-1.5 text-xs font-medium leading-5 text-slate-300">
              Các lượt khám đã hoàn tất được sắp xếp mới nhất trước. Thông tin này hỗ trợ suy luận, không thay thế đánh giá hiện tại.
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <HistoryMetric value={history.length} label="Lượt khám" />
            <HistoryMetric value={diagnosisCount} label="Kết luận" />
            <HistoryMetric value={aiDiagnosisCount} label="Tham vấn AI" />
            <HistoryMetric value={resultCount} label="Kết quả" />
          </div>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="p-8">
          <Empty title="Chưa có bệnh án lịch sử" desc="Bệnh nhân chưa có lượt khám đã hoàn tất nào trước lần khám hiện tại." />
        </div>
      ) : (
        <ol className="divide-y divide-slate-100" aria-label="Các lượt khám trước">
          {history.map((historicalVisit, index) => {
            const expanded = openVisitId === historicalVisit.id;
            const conclusion = historicalVisit.finalConclusion;
            const resultTotal = (historicalVisit.medicalOrders || []).reduce((total, order) => total + (order.results?.length || 0), 0);
            const doctorName = conclusion?.doctor?.staffProfile?.fullName || historicalVisit.staff?.fullName || 'Chưa cập nhật';
            return (
              <li key={historicalVisit.id} className="relative pl-12 pr-5 py-5 [content-visibility:auto]">
                <span className={`absolute left-5 top-6 grid h-6 w-6 place-items-center rounded-full border text-[10px] font-black ${index === 0 ? 'border-indigo-500 bg-indigo-600 text-white ring-4 ring-indigo-50' : 'border-slate-200 bg-white text-slate-500'}`}>
                  {index + 1}
                </span>
                {index < history.length - 1 ? <span className="absolute bottom-0 left-8 top-12 w-px bg-slate-200" aria-hidden="true" /> : null}

                <button
                  id={`medical-history-visit-${historicalVisit.id}`}
                  type="button"
                  onClick={() => setOpenVisitId(expanded ? '' : historicalVisit.id)}
                  aria-expanded={expanded}
                  aria-controls={`medical-history-detail-${historicalVisit.id}`}
                  className="group flex w-full flex-col gap-3 text-left sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <time className="text-sm font-black text-slate-900" dateTime={historicalVisit.checkInAt}>{formatDate(historicalVisit.checkInAt)}</time>
                      <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-500">{historicalVisit.visitCode}</span>
                      {index === 0 ? <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">Gần nhất</span> : null}
                    </div>
                    <p className="mt-1 truncate text-xs font-bold text-slate-600">{historicalVisit.department?.name || 'Chưa cập nhật khoa'} · BS. {doctorName}</p>
                    <p className="mt-2 text-sm font-bold leading-5 text-slate-900">{conclusion?.finalDiagnosis || 'Chưa có chẩn đoán được ghi nhận'}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 self-stretch sm:self-auto">
                    <span className="rounded-lg border border-sky-100 bg-sky-50 px-2.5 py-1 text-[10px] font-bold text-sky-700">{resultTotal} kết quả</span>
                    <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </div>
                </button>

                {expanded ? (
                  <div id={`medical-history-detail-${historicalVisit.id}`} className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <HistoryTextCard icon={<Activity className="h-4 w-4" />} title="Hướng điều trị" value={conclusion?.treatmentPlan} />
                        <HistoryTextCard icon={<Pill className="h-4 w-4" />} title="Toa thuốc" value={conclusion?.prescription} tone="emerald" />
                        <HistoryTextCard icon={<Clock className="h-4 w-4" />} title="Dặn dò / Tái khám" value={conclusion?.followUpNote} />
                        <HistoryTextCard icon={<FileText className="h-4 w-4" />} title="Ghi chú bác sĩ" value={conclusion?.doctorNote} />
                      </div>
                      <HistoricalOrders orders={historicalVisit.medicalOrders || []} />
                    </div>
                    <HistoricalAiDiagnoses diagnoses={historicalVisit.aiDiagnoses || []} selectedDiagnosisId={conclusion?.aiDiagnosisId} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function HistoryMetric({ value, label }) {
  return (
    <div className="min-w-20 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 backdrop-blur-sm">
      <strong className="block text-lg font-black text-white">{value}</strong>
      <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-200">{label}</span>
    </div>
  );
}

function HistoryTextCard({ icon, title, value, tone = 'indigo' }) {
  const tones = tone === 'emerald'
    ? 'border-emerald-100 bg-emerald-50/60 text-emerald-700'
    : 'border-indigo-100 bg-indigo-50/50 text-indigo-700';
  return (
    <article className={`rounded-2xl border p-4 ${tones}`}>
      <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider">
        {icon}<span>{title}</span>
      </h4>
      <p className="mt-2 whitespace-pre-wrap text-xs font-semibold leading-5 text-slate-700">{value || 'Không ghi nhận'}</p>
    </article>
  );
}

function HistoricalAiDiagnoses({ diagnoses, selectedDiagnosisId }) {
  if (diagnoses.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50/80 via-white to-sky-50/60" aria-label="Chẩn đoán tham vấn AI trước đây">
      <div className="flex flex-col gap-3 border-b border-violet-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="flex items-center gap-2 text-xs font-black text-violet-950">
            <Sparkles className="h-4 w-4 text-violet-600" aria-hidden="true" />
            Tham vấn AI trước đây
          </h4>
          <p className="mt-1 text-[10px] font-semibold text-slate-500">Chỉ dùng để tham khảo; kết luận cuối cùng thuộc về bác sĩ.</p>
        </div>
        <span className="w-fit rounded-full border border-violet-200 bg-white px-2.5 py-1 text-[10px] font-bold text-violet-700">{diagnoses.length} bản phân tích</span>
      </div>

      <div className="grid gap-3 p-4 lg:grid-cols-2">
        {diagnoses.map((diagnosis) => {
          const parsed = normalizeAiAnalysis(diagnosis.result);
          const reviewed = diagnosis.status === 'DOCTOR_REVIEWED' || Boolean(diagnosis.reviewedByDoctor);
          const modelName = parsed.modelName || diagnosis.aiModel?.modelName || 'Mô hình AI';
          const provider = parsed.provider || diagnosis.aiModel?.provider || 'AI';
          return (
            <article key={diagnosis.id} className="rounded-2xl border border-white bg-white/90 p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-[0.16em] text-violet-500">{provider}</span>
                  <h5 className="mt-0.5 text-xs font-black text-slate-900">
                    {modelName}{diagnosis.aiModel?.modelVersion ? ` · ${diagnosis.aiModel.modelVersion}` : ''}
                  </h5>
                  <time className="mt-1 block text-[10px] font-semibold text-slate-400" dateTime={diagnosis.createdAt}>{formatDate(diagnosis.createdAt)} · {formatTime(diagnosis.createdAt)}</time>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {diagnosis.id === selectedDiagnosisId ? <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-black text-violet-700">Được dùng khi kết luận</span> : null}
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10px] font-black text-sky-700">Tin cậy {formatConfidence(diagnosis.confidence)}</span>
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${reviewed ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                    {reviewed ? 'Đã được bác sĩ xem' : 'Chưa được bác sĩ duyệt'}
                  </span>
                </div>
              </div>

              <div className="mt-3 space-y-3 text-xs">
                {parsed.summary ? <AiSection title="Tổng quan lâm sàng" value={parsed.summary} /> : null}
                <ImageFindingsSection value={parsed.imageFindings} />
                <DiagnosticProbabilitySection value={parsed.diagnosticProbabilities} />
                <div className="grid gap-3 sm:grid-cols-2">
                  {parsed.clinicalConsiderations || parsed.possibleConditions ? (
                    <AiSection title="Cân nhắc lâm sàng" value={parsed.clinicalConsiderations || parsed.possibleConditions} list />
                  ) : null}
                  {parsed.riskFlags ? <AiSection title="Cảnh báo rủi ro" value={parsed.riskFlags} list /> : null}
                </div>
                {!parsed.summary && !parsed.imageFindings?.length && !parsed.diagnosticProbabilities?.length ? (
                  <p className="rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-500">Không có nội dung phân tích chi tiết.</p>
                ) : null}
              </div>

              {diagnosis.doctorFeedback ? (
                <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3">
                  <strong className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Phản hồi của bác sĩ</strong>
                  <p className="mt-1 whitespace-pre-wrap text-xs font-semibold leading-5 text-slate-700">{diagnosis.doctorFeedback}</p>
                  {diagnosis.reviewedByDoctor?.staffProfile?.fullName ? <p className="mt-1 text-[10px] font-bold text-slate-400">BS. {diagnosis.reviewedByDoctor.staffProfile.fullName}</p> : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function HistoricalOrders({ orders }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4" aria-label="Chỉ định và kết quả cũ">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-xs font-black text-slate-900">Cận lâm sàng đã thực hiện</h4>
        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-slate-500 shadow-sm">{orders.length} phiếu</span>
      </div>
      {orders.length === 0 ? (
        <p className="mt-3 text-xs font-medium text-slate-400">Không có chỉ định trong lượt khám này.</p>
      ) : (
        <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
          {orders.map((order) => (
            <article key={order.id} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <strong className="block text-xs font-bold text-slate-800">{order.orderType}</strong>
                  <span className="text-[10px] font-semibold text-slate-400">{order.targetDepartment?.name || order.orderCode}</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-700">{order.results?.length || 0} KQ</span>
              </div>
              {(order.results || []).map((result) => (
                <div key={result.id} className="mt-2 border-l-2 border-sky-200 pl-3">
                  <p className="whitespace-pre-wrap text-[11px] font-semibold leading-4 text-slate-600">{result.note || 'Không có ghi chú kết quả.'}</p>
                  {result.files?.length ? (
                    <p className="mt-1 text-[10px] font-bold text-sky-700">{result.files.length} tệp kết quả đã lưu trong hồ sơ</p>
                  ) : null}
                </div>
              ))}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function WorkflowActions({ secondaryLabel, onSecondary, extraLabel, onExtra, primaryLabel, onPrimary, primaryDisabled = false, primaryHint = '' }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-200/80 pt-4">
      <div>{primaryHint && <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-800">{primaryHint}</p>}</div>
      <div className="flex flex-wrap justify-end gap-2">
        {secondaryLabel && <button type="button" onClick={onSecondary} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors">{secondaryLabel}</button>}
        {extraLabel && <button type="button" onClick={onExtra} className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-xs font-bold text-sky-700 hover:bg-sky-100 transition-colors">{extraLabel}</button>}
        {primaryLabel && <button type="button" onClick={onPrimary} disabled={primaryDisabled} className="rounded-xl bg-sky-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50 transition-all">{primaryLabel}</button>}
      </div>
    </div>
  );
}

function OrderPanel({ visit, forms, setForms, departments, existingOrders = [], onSubmit, busy }) {
  const canOrder = ['IN_PROGRESS', 'WAITING_TEST_RESULT', 'WAITING_CONCLUSION'].includes(visit?.status);
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
    <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">Danh sách phiếu chỉ định cận lâm sàng</h3>
          <p className="mt-0.5 text-xs font-semibold text-slate-500">
            Đã gửi: <span className="text-sky-600 font-bold">{existingOrders.length}</span> phiếu • Đang soạn: <span className="text-sky-600 font-bold">{forms.length}</span> phiếu
          </p>
        </div>
        {canOrder && (
          <button
            type="button"
            onClick={addForm}
            className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-bold text-sky-700 hover:bg-sky-100 transition-colors"
          >
            + Tạo thêm phiếu mới
          </button>
        )}
      </div>

      {!canOrder ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-800">
          Thông báo: Bác sĩ cần bấm "Bắt đầu khám" ở danh sách để kích hoạt quyền tạo chỉ định cận lâm sàng.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          {existingOrders.length > 0 && (
            <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h4 className="text-xs font-bold text-sky-900">Phiếu chỉ định đã gửi</h4>
                <span className="rounded-full bg-white px-3 py-0.5 text-[11px] font-bold text-sky-700 border border-sky-200">
                  {existingOrders.length} phiếu
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {existingOrders.map((order) => (
                  <div key={order.id} className="rounded-xl border border-sky-100 bg-white p-3 text-xs shadow-xs">
                    <strong className="block text-slate-900 font-bold">{order.orderType}</strong>
                    <span className="mt-0.5 block text-[11px] font-medium text-slate-400">{order.orderCode} • {order.targetDepartment?.name || 'N/A'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {forms.map((form, index) => (
            <div key={index} className="rounded-2xl border border-sky-200 bg-sky-50/30 p-5 space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-sky-900 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-200 text-[10px] font-bold text-sky-800">{index + 1}</span>
                  Soạn phiếu mới
                </h4>
                {forms.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeForm(index)}
                    className="text-xs font-bold text-rose-600 hover:text-rose-800 transition-colors"
                  >
                    Xóa phiếu này
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Khoa / Phòng thực hiện <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={form.targetDepartmentId}
                    onChange={(e) => handleDepartmentChange(index, e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs font-semibold outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition-all"
                  >
                    <option value="">-- Chọn phòng xét nghiệm / chẩn đoán hình ảnh --</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name} • {d.type === 'IMAGING' ? 'Chẩn đoán hình ảnh' : 'Xét nghiệm'}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tên / Loại chỉ định <span className="text-rose-500">*</span>
                  </label>
                  <input
                    value={form.orderType}
                    onChange={(e) => updateForm(index, { orderType: e.target.value })}
                    required
                    placeholder="VD: Siêu âm ổ bụng, Chụp X-Quang phổi..."
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs font-semibold outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition-all"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ghi chú lâm sàng cho KTV
                  </label>
                  <input
                    value={form.clinicalNote}
                    onChange={(e) => updateForm(index, { clinicalNote: e.target.value })}
                    placeholder="VD: Nghi ngờ viêm ruột thừa, tập trung kiểm tra hố chậu phải..."
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs font-semibold outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition-all"
                  />
                </div>
              </div>
            </div>
          ))}

          {hasDuplicateDepartments && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
              Cảnh báo: Có sự trùng lặp phòng thực hiện giữa các phiếu. Vui lòng gộp chung chỉ định vào 1 phiếu.
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={busy || hasDuplicateDepartments}
              className="rounded-xl bg-sky-600 px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-sky-700 disabled:opacity-50 transition-all"
            >
              {busy ? 'Đang gửi phiếu...' : 'Xác nhận & Gửi tất cả phiếu'}
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
  const toast = useToast();

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-4">
      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
        <h3 className="text-base font-bold text-slate-900">Kết quả cận lâm sàng trả về</h3>
        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
          Tổng: {orders.length} phiếu
        </span>
      </div>

      {orders.length === 0 ? (
        <Empty title="Chưa có phiếu chỉ định" desc="Bác sĩ chưa tạo bất kỳ phiếu yêu cầu cận lâm sàng nào." />
      ) : (
        <div className="space-y-4">
          {pendingOrders.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center justify-between">
              <span className="text-xs font-bold text-amber-800">Đang thực hiện {pendingOrders.length} phiếu...</span>
              <LoadingIndicator size="sm" />
            </div>
          )}

          {completedOrders.length > 0 && (
            <div className="space-y-3">
              {completedOrders.map(order => (
                <div key={order.id} className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <strong className="text-xs font-bold text-emerald-900">{order.orderType}</strong>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      Đã trả KQ
                    </span>
                  </div>
                  {order.results?.length > 0 ? order.results.map(res => (
                    <div key={res.id} className="bg-white rounded-xl border border-emerald-100 p-3.5 text-xs shadow-xs space-y-2">
                      {res.note && (
                        <p className="text-slate-700"><span className="font-bold text-slate-900">KTV Ghi chú:</span> {res.note}</p>
                      )}
                      {res.files?.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {res.files.map(f => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={async () => {
                                try {
                                  const dl = await medicalOrderService.getResultFileDownloadUrl(f.id);
                                  if (dl.data?.url) window.open(dl.data.url, '_blank', 'noopener,noreferrer');
                                } catch {
                                  toast.error('Không tải được tệp kết quả.');
                                }
                              }}
                              className="flex items-center gap-1.5 text-xs font-bold text-sky-700 bg-sky-50 px-3 py-1.5 rounded-xl border border-sky-200 hover:bg-sky-100 transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Xem {f.originalName?.slice(-15) || 'Tệp đính kèm'}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )) : (
                    <div className="text-xs text-slate-400 italic">Chưa cập nhật nội dung chi tiết.</div>
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
  const rankedDiagnoses = useMemo(() => [...diagnoses].sort((a, b) => (Number(b.confidence) || 0) - (Number(a.confidence) || 0)), [diagnoses]);
  const currentDiagnosis = rankedDiagnoses.find((diagnosis) => diagnosis.id === selectedAiId) || rankedDiagnoses[0];
  const parsedResult = normalizeAiAnalysis(currentDiagnosis?.result);
  const selectedModel = aiModels.find((model) => model.id === selectedAiModelId);

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-5">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-sky-600" />
            <span>Phân tích & Chẩn đoán tham vấn AI</span>
          </h3>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 xl:min-w-[500px]">
          <select
            value={selectedAiModelId}
            onChange={(e) => setSelectedAiModelId(e.target.value)}
            disabled={busy}
            className="flex-1 rounded-xl border border-sky-200 bg-sky-50/50 p-2.5 text-xs font-bold text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:opacity-50 transition-all"
          >
            <option value="">-- Chọn mô hình AI --</option>
            {aiModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.modelName || model.name || 'Mô hình AI'} {model.modelVersion || model.version ? `(${model.modelVersion || model.version})` : ''} - {model.recommendedSpecialty || 'Tổng quát'}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onGenerate}
            disabled={busy || !selectedAiModelId}
            className="rounded-xl bg-sky-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-sky-700 disabled:opacity-50 whitespace-nowrap transition-all flex items-center justify-center gap-2"
          >
            {busy ? <LoadingIndicator size="sm" tone="white" /> : 'Chạy mô hình AI'}
          </button>
        </div>
      </div>

      {diagnoses.length > 0 ? (
        <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-5 items-start">
          <aside className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3 space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Lịch sử phân tích</span>
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-sky-700 border border-sky-200">
                {diagnoses.length} bản
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 max-h-[480px] overflow-y-auto pr-1 scrollbar-thin">
              {rankedDiagnoses.map((diagnosis, index) => {
                const parsed = normalizeAiAnalysis(diagnosis.result);
                const isSelected = diagnosis.id === currentDiagnosis?.id;
                return (
                  <button
                    key={diagnosis.id}
                    type="button"
                    onClick={() => setSelectedAiId(diagnosis.id)}
                    className={`w-full rounded-2xl border p-3 text-left transition-all ${
                      isSelected ? 'border-sky-400 bg-white shadow-xs ring-2 ring-sky-100' : 'border-slate-200/80 bg-white/70 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 border border-sky-200">
                        #{index + 1} • {parsed.provider || diagnosis.aiModel?.provider || 'AI'}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400">{formatTime(diagnosis.createdAt)}</span>
                    </div>
                    <strong className="mt-1.5 block text-xs font-bold text-slate-900">
                      {parsed.modelName || diagnosis.aiModel?.modelName || diagnosis.aiModel?.name || 'Mô hình AI'}
                    </strong>
                    <div className="mt-1.5 flex items-center justify-between text-[10px] font-bold text-slate-500">
                      <span>Độ tin cậy</span>
                      <span className="text-sky-600">{formatConfidence(diagnosis.confidence)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="rounded-2xl border border-sky-200 bg-sky-50/30 p-5 text-xs text-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-100 pb-3">
              <div>
                <span className="rounded-full border border-sky-200 bg-white px-3 py-0.5 text-[10px] font-bold text-sky-700">
                  Gợi ý hỗ trợ chẩn đoán • Bác sĩ quyết định cuối cùng
                </span>
                <h4 className="mt-2 text-base font-bold text-slate-900">
                  {parsedResult.modelName || currentDiagnosis?.aiModel?.modelName || currentDiagnosis?.aiModel?.name || 'Mô hình AI'}
                </h4>
              </div>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                Confidence {formatConfidence(currentDiagnosis?.confidence)}
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="lg:col-span-2 rounded-xl border border-white bg-white p-4 shadow-xs">
                <AiSection title="Tổng quan lâm sàng" value={parsedResult.summary} />
              </div>
              <div className="lg:col-span-2 rounded-xl border border-white bg-white p-4 shadow-xs">
                <ImageFindingsSection value={parsedResult.imageFindings} />
              </div>
              <div className="lg:col-span-2 rounded-xl border border-white bg-white p-4 shadow-xs">
                <DiagnosticProbabilitySection value={parsedResult.diagnosticProbabilities} />
              </div>
              <div className="rounded-xl border border-white bg-white p-4 shadow-xs">
                <AiSection title="Cân nhắc lâm sàng" value={parsedResult.clinicalConsiderations || parsedResult.possibleConditions} list />
              </div>
              <div className="rounded-xl border border-white bg-white p-4 shadow-xs">
                <AiSection title="Cảnh báo rủi ro" value={parsedResult.riskFlags} list />
              </div>
            </div>
          </section>
        </div>
      ) : (
        <Empty title="Chưa có bản phân tích AI" desc="Chọn mô hình AI và bấm 'Chạy mô hình AI' để tạo phân tích đầu tiên." />
      )}
    </div>
  );
}

function normalizeAiAnalysis(value) {
  const parsed = parseAiResult(value);
  const analysis = parsed?.analysis && typeof parsed.analysis === 'object' && !Array.isArray(parsed.analysis) ? parsed.analysis : {};
  return { ...parsed, ...analysis, summary: analysis.summary || parsed.summary, imageFindings: analysis.imageFindings || parsed.imageFindings, diagnosticProbabilities: analysis.diagnosticProbabilities || analysis.differentialDiagnoses || analysis.possibleDiagnoses || parsed.diagnosticProbabilities, clinicalConsiderations: analysis.clinicalConsiderations || parsed.clinicalConsiderations, riskFlags: analysis.riskFlags || parsed.riskFlags, recommendedNextSteps: analysis.recommendedNextSteps || parsed.recommendedNextSteps, limitations: analysis.limitations || parsed.limitations };
}

function confidencePercent(value) {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return 0;
  return raw <= 1 ? Math.round(raw * 100) : Math.round(Math.max(0, Math.min(100, raw)));
}

function formatConfidence(value) {
  const percent = confidencePercent(value);
  return percent ? `${percent}%` : 'N/A';
}

const SEVERITY_TONE = {
  'nặng': 'bg-rose-50 text-rose-700 border-rose-100',
  'trung bình': 'bg-amber-50 text-amber-700 border-amber-100',
  'nhẹ': 'bg-emerald-50 text-emerald-700 border-emerald-100',
  'không rõ': 'bg-slate-50 text-slate-600 border-slate-200',
};

function ImageFindingsSection({ value }) {
  const items = Array.isArray(value) ? value : [];
  if (!items.length) return null;
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <strong className="text-xs font-bold text-sky-900">Phát hiện trên ảnh y khoa</strong>
        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 border border-sky-100">{items.length} ảnh</span>
      </div>
      <div className="space-y-2">
        {items.map((item, index) => {
          const modality = item.modality || item.type || `Ảnh ${index + 1}`;
          const finding = item.finding || item.observation || item.description || (typeof item === 'string' ? item : JSON.stringify(item));
          const severity = String(item.severity || '').toLowerCase();
          const tone = SEVERITY_TONE[severity] || 'bg-slate-50 text-slate-600 border-slate-200';
          return (
            <div key={`img-${index}`} className="rounded-xl border border-slate-100 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-900">{modality}</span>
                {severity && <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${tone}`}>{item.severity}</span>}
              </div>
              <p className="mt-1 text-xs font-medium text-slate-600">{finding}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DiagnosticProbabilitySection({ value }) {
  if (!value) return null;
  const items = Array.isArray(value) ? value : [];
  if (!items.length) return null;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <strong className="text-xs font-bold text-sky-900">Khả năng chẩn đoán</strong>
      </div>
      <div className="space-y-2.5">
        {items.map((item, index) => {
          const condition = item.condition || item.name || item.diagnosis || `Khả năng ${index + 1}`;
          const probability = Math.max(0, Math.min(100, Number(item.probability ?? item.percent ?? item.score ?? 0)));
          return (
            <div key={`${condition}-${index}`}>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-bold text-slate-800">{condition}</span>
                <span className="font-bold text-sky-600">{probability}%</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-sky-500" style={{ width: `${probability}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AiSection({ title, value, list = false }) {
  if (!value) return null;
  const items = Array.isArray(value) ? value : [value];
  return (
    <div>
      <strong className="text-xs font-bold text-sky-900 block mb-1.5">{title}</strong>
      {list ? (
        <ul className="list-disc pl-5 space-y-1 font-medium text-slate-700 marker:text-sky-400">
          {items.map((item, index) => <li key={`${title}-${index}`}>{typeof item === 'object' ? JSON.stringify(item) : String(item)}</li>)}
        </ul>
      ) : (
        <p className="font-medium text-slate-700 leading-relaxed">{String(value)}</p>
      )}
    </div>
  );
}

function ConclusionPanel({ form, setForm, onSubmit, busy, completed, activeVisit, activeConclusion }) {
  const updateForm = (patch) => setForm({ ...form, ...patch });

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
            Chẩn đoán xác định <span className="text-rose-500">*</span>
          </label>
          <textarea
            required
            rows={2}
            value={form.finalDiagnosis}
            onChange={(e) => updateForm({ finalDiagnosis: e.target.value })}
            className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-xs font-semibold outline-none focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100 transition-all"
            placeholder="VD: Viêm loét dạ dày tá tràng K27..."
            disabled={completed}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Hướng điều trị</label>
            <textarea
              rows={3}
              value={form.treatmentPlan}
              onChange={(e) => updateForm({ treatmentPlan: e.target.value })}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-xs font-semibold outline-none focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100 transition-all"
              placeholder="VD: Điều trị nội khoa ngoại trú, ăn uống kiêng cữ..."
              disabled={completed}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Toa thuốc (Kê đơn)</label>
            <textarea
              rows={3}
              value={form.prescription}
              onChange={(e) => updateForm({ prescription: e.target.value })}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-xs font-semibold outline-none focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100 transition-all"
              placeholder="VD: 1. Omeprazol 20mg x 14 viên (Sáng 1 viên)..."
              disabled={completed}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Lời dặn / Hẹn tái khám</label>
            <input
              value={form.followUpNote}
              onChange={(e) => updateForm({ followUpNote: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-xs font-semibold outline-none focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100 transition-all"
              placeholder="VD: Tái khám sau 7 ngày..."
              disabled={completed}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Ghi chú ẩn (Nội bộ BS)</label>
            <input
              value={form.doctorNote}
              onChange={(e) => updateForm({ doctorNote: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-xs font-semibold outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition-all"
              placeholder="Ghi chú thêm về bệnh nhân..."
              disabled={completed}
            />
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-100">
          <button
            type="submit"
            disabled={busy || completed}
            className={`rounded-xl px-8 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-xs transition-all ${
              completed
                ? 'bg-slate-300 shadow-none text-slate-500 cursor-not-allowed'
                : 'bg-sky-600 hover:bg-sky-700 disabled:opacity-50'
            }`}
          >
            {busy ? 'Đang lưu bệnh án...' : completed ? 'Hồ sơ đã đóng' : 'Hoàn tất & Đóng bệnh án'}
          </button>
        </div>

        {completed && (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={() => {
                const qrData = `KLTN-PATIENT-${activeVisit?.patient?.patientCode || activeVisit?.visitCode || ''}`;
                printConclusionWithQR(activeVisit, activeConclusion, qrData);
              }}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl border border-sky-200 bg-sky-50 text-sky-700 font-bold text-xs hover:bg-sky-100 transition-colors shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>In PDF kèm Mã QR xác minh</span>
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

function Empty({ title, desc }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center bg-slate-50/40 rounded-2xl">
      <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center mb-3 text-slate-400">
        <FileText className="w-6 h-6 stroke-[1.75]" />
      </div>
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      <p className="mt-1 text-xs font-medium text-slate-400 max-w-sm mx-auto">{desc}</p>
    </div>
  );
}
